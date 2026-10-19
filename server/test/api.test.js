import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../app.js';
import { openDatabase } from '../db.js';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'building-api-'));
let app,server,base,alice,bob,outsider,project,child,work,uploaded,report;
const origin='http://localhost:5173';
async function request(method,url,body,account,extra={}) {
  const headers={Origin:origin,...extra};
  if(account){headers.Cookie=account.cookie;headers['X-CSRF-Token']=account.csrfToken;}
  if(account && !Object.hasOwn(headers,'If-Match') && ['PATCH','PUT'].includes(method) && url.startsWith('/works/')) {
    const match=url.match(/^(\/works\/[^/]+)(?:\/(reports)\/([^/]+)|\/(?:status|assignees))?$/);
    if(match) {
      const current=await request('GET',match[1]+(match[2] ? '/reports' : ''),null,account);
      const version=match[2] ? current.data.find?.(report=>report.id===match[3])?.version : current.data.version;
      if(version)headers['If-Match']=JSON.stringify(version);
    }
  }
  let payload=body;
  if(body && !(body instanceof FormData)){headers['Content-Type']='application/json';payload=JSON.stringify(body);}
  const response=await fetch(base+'/api'+url,{method,headers,body:payload});
  const data=response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.arrayBuffer();
  return {status:response.status,data,headers:response.headers};
}
async function signup(username) {
  const response=await request('POST','/auth/register',{name:username,username,email:username+'@example.test',password:'strong-password-123'});
  assert.equal(response.status,201);
  return {...response.data,cookie:response.headers.get('set-cookie').split(';')[0],headers:response.headers};
}
const workBody=()=>({title:'کار واقعی',projectId:child.id,floorNum:3,summary:'توضیحات',prerequisite:'پیش‌نیاز'});
before(async()=>{
  app=createApp({databasePath:path.join(directory,'app.sqlite'),uploadsDir:path.join(directory,'uploads'),distDir:path.join(directory,'no-dist'),origin});
  server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{
  await new Promise(resolve=>server.close(resolve));
  app.locals.db.close();
  fs.rmSync(directory,{recursive:true,force:true});
});
test('anonymous routes and forged origins are rejected',async()=>{
  assert.equal((await request('GET','/projects')).status,401);
  assert.equal((await request('GET','/works')).status,401);
  assert.equal((await request('GET','/health')).status,200);
  assert.equal((await request('POST','/auth/login',{identifier:'demo',password:'123456'},null,{Origin:'https://evil.example'})).status,403);
});
test('registration hashes passwords and sets HttpOnly SameSite cookies',async()=>{
  alice=await signup('alice');bob=await signup('bob');outsider=await signup('outsider');
  assert.match(alice.headers.get('set-cookie'),/HttpOnly/);
  assert.match(alice.headers.get('set-cookie'),/SameSite=Lax/);
  const stored=app.locals.db.prepare('SELECT * FROM users WHERE id=?').get(alice.user.id);
  assert.match(stored.password_hash,/^scrypt\$/);
  assert.notEqual(stored.password_hash,'strong-password-123');
  assert.equal((await request('POST','/auth/register',{name:'a',username:'alice',email:'alice@example.test',password:'strong-password-123'})).status,409);
  assert.equal((await request('POST','/auth/register',{name:'a',username:'short',email:'short@example.test',password:'123'})).status,400);
  assert.equal((await request('POST','/auth/login',{identifier:'alice',password:'wrong'})).status,401);
});
test('CSRF is required for mutations',async()=>{
  const result=await request('POST','/projects',{name:'no csrf'},null,{Cookie:alice.cookie});
  assert.equal(result.status,403);
  assert.equal((await request('POST','/projects',{name:{bad:true}},alice)).status,400);
});
test('the original username-only signup form requires no additional email field',async()=>{
  const response=await request('POST','/auth/register',{name:'Original User',username:'original_form',password:'original-password-123'});
  assert.equal(response.status,201);assert.equal(response.data.user.email,null);
  const login=await request('POST','/auth/login',{identifier:'original_form',password:'original-password-123'});
  assert.equal(login.status,200);
});
test('projects have private ownership and inherited memberships',async()=>{
  project=(await request('POST','/projects',{name:'پروژه اصلی'},alice)).data;
  child=(await request('POST','/projects',{name:'زیرپروژه',parentId:project.id},alice)).data;
  assert.equal(child.rootId,project.id);
  assert.equal((await request('GET','/projects',null,bob)).data.length,0);
  assert.equal((await request('GET','/projects/'+child.id,null,bob)).status,404);
  assert.equal((await request('POST','/projects/'+project.id+'/members',{identifier:'bob'},alice)).status,201);
  assert.equal((await request('GET','/projects',null,bob)).data.length,2);
  assert.equal((await request('POST','/projects/'+project.id+'/members',{identifier:'outsider'},bob)).status,403);
  assert.equal((await request('PATCH','/projects/'+project.id,{name:'forged'},bob)).status,403);
  assert.equal((await request('GET','/projects/tree',null,alice)).data[0].children[0].id,child.id);
});
test('work creation validates fields and hides inaccessible works',async()=>{
  work=(await request('POST','/works',workBody(),alice)).data;
  assert.equal(work.status,'in_progress');
  assert.equal(work.creator.id,alice.user.id);
  assert.equal((await request('POST','/works',{...workBody(),floorNum:8},alice)).status,400);
  assert.equal((await request('POST','/works',{...workBody(),projectId:'missing'},alice)).status,404);
  assert.equal((await request('GET','/works/'+encodeURIComponent(work.id),null,outsider)).status,404);
  assert.equal((await request('GET','/works',null,outsider)).data.total,0);
  assert.equal((await request('PATCH','/works/'+encodeURIComponent(work.id),workBody(),bob)).status,403);
});
test('report creation persists text without changing work status',async()=>{
  report=(await request('POST','/works/'+encodeURIComponent(work.id)+'/reports',{text:'گزارش واقعی'},bob)).data;
  assert.equal(report.author.id,bob.user.id);
  const result=await request('GET','/works/'+encodeURIComponent(work.id),null,alice);
  assert.equal(result.data.status,'in_progress');
  assert.equal((await request('GET','/works/'+encodeURIComponent(work.id)+'/reports',null,alice)).data[0].text,'گزارش واقعی');
  assert.equal((await request('PATCH','/works/'+encodeURIComponent(work.id)+'/reports/'+report.id,{text:'ویرایش'},bob)).status,200);
  assert.equal((await request('POST','/works/'+encodeURIComponent(work.id)+'/reports',{text:''},bob)).status,400);
  await request('POST','/projects/'+project.id+'/members',{identifier:'outsider'},alice);
  assert.equal((await request('PATCH','/works/'+encodeURIComponent(work.id)+'/reports/'+report.id,{text:'forged'},outsider)).status,403);
  await request('DELETE','/projects/'+project.id+'/members/'+outsider.user.id,null,alice);
});
test('assignees must be project members and can change status',async()=>{
  const route='/works/'+encodeURIComponent(work.id);
  assert.equal((await request('PATCH',route+'/status',{status:'done'},bob)).status,403);
  assert.equal((await request('PUT',route+'/assignees',{userIds:[outsider.user.id]},alice)).status,400);
  assert.equal((await request('PUT',route+'/assignees',{userIds:[bob.user.id]},alice)).status,200);
  assert.equal((await request('PATCH',route+'/status',{status:'done'},bob)).status,200);
  assert.equal((await request('PATCH',route+'/status',{status:'invalid'},alice)).status,400);
  assert.equal((await request('GET','/works?mine=true&status=done',null,bob)).data.items[0].id,work.id);
});
test('removing a member revokes file/work access and assignments',async()=>{
  assert.equal((await request('DELETE','/projects/'+project.id+'/members/'+bob.user.id,null,alice)).status,204);
  assert.equal((await request('GET','/works/'+encodeURIComponent(work.id),null,bob)).status,404);
  assert.equal((await request('GET','/works/'+encodeURIComponent(work.id),null,alice)).data.assignees.length,0);
  assert.equal((await request('DELETE','/projects/'+project.id+'/members/'+alice.user.id,null,alice)).status,400);
  await request('POST','/projects/'+project.id+'/members',{identifier:'bob'},alice);
});
test('concurrent work writes get distinct ids and deleted ids are never reused',async()=>{
  const responses=await Promise.all(Array.from({length:8},(_,i)=>request('POST','/works',{...workBody(),title:'parallel '+i},alice)));
  assert.ok(responses.every(r=>r.status===201));
  const ids=responses.map(r=>r.data.id);assert.equal(new Set(ids).size,8);
  await request('DELETE','/works/'+encodeURIComponent(ids.at(-1)),null,alice);
  const next=await request('POST','/works',workBody(),alice);
  assert.ok(!ids.includes(next.data.id));
});
test('pagination, subtree filtering, literal search and renaming work',async()=>{
  await request('POST','/works',{...workBody(),title:'100% test'},alice);
  const result=await request('GET','/works?projectId='+project.id+'&page=1&limit=2',null,alice);
  assert.equal(result.status,200);assert.equal(result.data.items.length,2);assert.ok(result.data.total>2);
  assert.equal((await request('GET','/works?q=%25',null,alice)).data.total,1);
  assert.equal((await request('GET','/works?limit=-1',null,alice)).status,400);
  await request('PATCH','/projects/'+project.id,{name:'نام جدید'},alice);
  assert.ok((await request('GET','/works/'+encodeURIComponent(work.id),null,alice)).data.project.startsWith('نام جدید'));
  assert.equal((await request('DELETE','/projects/'+project.id,null,alice)).status,409);
});
test('uploads are private, downloadable, validated and removed with work',async()=>{
  const form=new FormData();
  for(const [key,value] of Object.entries({...workBody(),title:'فایل‌دار'}))form.set(key,String(value));
  form.set('cover',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2uoAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'cover.png');
  form.set('attachment',new Blob(['private report'],{type:'text/plain'}),'report.txt');
  const response=await request('POST','/works',form,alice);assert.equal(response.status,201);uploaded=response.data;
  assert.equal((await request('GET','/files/'+uploaded.attachment.id)).status,401);
  assert.equal((await request('GET','/files/'+uploaded.attachment.id,null,outsider)).status,404);
  const file=await request('GET','/files/'+uploaded.attachment.id,null,bob);
  assert.equal(file.status,200);assert.match(file.headers.get('content-disposition'),/attachment/);
  assert.equal(Buffer.from(file.data).toString(),'private report');
  const invalid=new FormData();
  for(const [key,value] of Object.entries(workBody()))invalid.set(key,String(value));
  invalid.set('attachment',new Blob(['must roll back']),'temp.txt');
  invalid.set('cover',new Blob(['<svg onload=evil()>'],{type:'image/png'}),'fake.png');
  const before=fs.readdirSync(path.join(directory,'uploads')).length;
  assert.equal((await request('POST','/works',invalid,alice)).status,400);
  assert.equal(fs.readdirSync(path.join(directory,'uploads')).length,before);
});
test('editing work, replacing attachments, and cascade deletion persist',async()=>{
  const route='/works/'+encodeURIComponent(uploaded.id);
  const form=new FormData();
  for(const [key,value] of Object.entries({...workBody(),title:'عنوان جدید',floorNum:4}))form.set(key,String(value));
  form.set('removeCover','true');
  form.set('attachment',new Blob(['replacement']),'replacement.txt');
  const changed=await request('PATCH',route,form,alice);
  assert.equal(changed.status,200);assert.equal(changed.data.cover,null);assert.equal(changed.data.floorNum,4);
  assert.equal((await request('GET','/files/'+uploaded.attachment.id,null,alice)).status,404);
  const reopened=openDatabase(path.join(directory,'app.sqlite'));
  assert.equal(reopened.prepare('SELECT title FROM works WHERE id=?').get(uploaded.id).title,'عنوان جدید');
  reopened.close();
  await request('POST',route+'/reports',{text:'delete with work'},alice);
  assert.equal((await request('DELETE',route,null,alice)).status,204);
  assert.equal((await request('GET','/files/'+changed.data.attachment.id,null,alice)).status,404);
  assert.equal(app.locals.db.prepare('SELECT count(*) AS n FROM reports WHERE work_id=?').get(uploaded.id).n,0);
});
test('project storage quota and upload size limits reject files without writing them',async()=>{
  const oldQuota=app.locals.config.projectFileQuotaBytes;
  const quotaForm=new FormData();
  for(const [key,value] of Object.entries(workBody()))quotaForm.set(key,String(value));
  quotaForm.set('attachment',new Blob(['quota']),'quota.txt');
  const count=fs.readdirSync(path.join(directory,'uploads')).length;
  try {
    app.locals.config.projectFileQuotaBytes=1;
    assert.equal((await request('POST','/works',quotaForm,alice)).status,413);
  } finally {app.locals.config.projectFileQuotaBytes=oldQuota;}
  const large=new FormData();
  for(const [key,value] of Object.entries(workBody()))large.set(key,String(value));
  large.set('attachment',new Blob([new Uint8Array(10*1024*1024+1)]),'large.bin');
  assert.equal((await request('POST','/works',large,alice)).status,400);
  assert.equal(fs.readdirSync(path.join(directory,'uploads')).length,count);
});
test('empty project deletion is owner-only and session expiry is enforced',async()=>{
  const empty=(await request('POST','/projects',{name:'empty'},alice)).data;
  await request('POST','/projects/'+empty.id+'/members',{identifier:'bob'},alice);
  assert.equal((await request('DELETE','/projects/'+empty.id,null,bob)).status,403);
  assert.equal((await request('DELETE','/projects/'+empty.id,null,alice)).status,204);
  const expiring=await signup('expiring');
  app.locals.db.prepare('UPDATE sessions SET expires_at=0 WHERE user_id=?').run(expiring.user.id);
  assert.equal((await request('GET','/auth/me',null,expiring)).status,401);
});
test('password changes revoke other sessions and logout invalidates the cookie',async()=>{
  const login=await request('POST','/auth/login',{identifier:'alice',password:'strong-password-123'});
  const second={...login.data,cookie:login.headers.get('set-cookie').split(';')[0]};
  const changed=await request('POST','/auth/password',{currentPassword:'strong-password-123',password:'new-password-123'},alice);
  assert.equal(changed.status,200);
  assert.equal((await request('GET','/auth/me',null,second)).status,401);
  assert.equal((await request('POST','/auth/login',{identifier:'alice',password:'strong-password-123'})).status,401);
  const active={...changed.data,cookie:changed.headers.get('set-cookie').split(';')[0]};
  assert.equal((await request('POST','/auth/logout',null,active)).status,204);
  assert.equal((await request('GET','/auth/me',null,active)).status,401);
});
test('production config requires HTTPS and issues Secure host-only cookies',async()=>{
  assert.throws(()=>createApp({production:true,origin:'http://example.com',databasePath:':memory:'}),/HTTPS/);
  const prod=createApp({production:true,secureCookies:true,origin:'https://example.com',databasePath:':memory:',uploadsDir:path.join(directory,'prod-uploads')});
  const prodServer=prod.listen(0,'127.0.0.1');await new Promise(resolve=>prodServer.once('listening',resolve));
  const response=await fetch('http://127.0.0.1:'+prodServer.address().port+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify({name:'Prod',username:'production',email:'prod@example.test',password:'production-password'})});
  assert.equal(response.status,201);assert.match(response.headers.get('set-cookie'),/^__Host-building_session=/);assert.match(response.headers.get('set-cookie'),/Secure/);
  await new Promise(resolve=>prodServer.close(resolve));prod.locals.db.close();
});
