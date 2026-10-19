import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../app.js';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'building-reliability-'));
const options={databasePath:path.join(directory,'app.sqlite'),uploadsDir:path.join(directory,'uploads'),distDir:path.join(directory,'no-dist'),origin:'http://localhost:5173'};
let app,server,base,owner,member,other,project;
async function call(method,url,body,account=owner,extra={},target=base) {
  const headers={Origin:options.origin,...extra};
  if(account){headers.Cookie=account.cookie;headers['X-CSRF-Token']=account.csrfToken;}
  if(body && !(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}
  const response=await fetch(target+'/api'+url,{method,headers,body});
  const data=response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
  return {status:response.status,data,headers:response.headers};
}
const key=()=>({'Idempotency-Key':randomUUID()});
const version=value=>({'If-Match':JSON.stringify(value.version)});
const route=work=>'/works/'+encodeURIComponent(work.id);
const body=title=>({title,projectId:project.id,floorNum:3,summary:'شرح کار',prerequisite:''});
async function newWork(title) {
  const result=await call('POST','/works',body(title));assert.equal(result.status,201);return result.data;
}
before(async()=>{
  app=createApp(options);server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  base='http://127.0.0.1:'+server.address().port;
  const signup=async username=>{
    const result=await call('POST','/auth/register',{name:username,username,password:'reliability-password-123'},null);
    assert.equal(result.status,201);return {...result.data,cookie:result.headers.get('set-cookie').split(';')[0]};
  };
  owner=await signup('reliable_owner');member=await signup('reliable_member');other=await signup('reliable_other');
  project=(await call('POST','/projects',{name:'Shared project'})).data;
  for(const person of [member,other])await call('POST','/projects/'+project.id+'/members',{identifier:person.user.username});
});
after(async()=>{await new Promise(resolve=>server.close(resolve));app.locals.db.close();fs.rmSync(directory,{recursive:true,force:true});});

test('project retry keys survive another server instance and stay scoped to the user and payload',async()=>{
  const headers=key();
  const results=await Promise.all([call('POST','/projects',{name:'One project',parentId:null},owner,headers),call('POST','/projects',{parentId:null,name:'One project'},owner,headers)]);
  assert(results.every(result=>result.status===201));assert.equal(results[0].data.id,results[1].data.id);
  assert.equal((await call('POST','/projects',{name:'Different project'},owner,headers)).status,409);
  const separate=await call('POST','/projects',{name:'One project',parentId:null},member,headers);
  assert.equal(separate.status,201);assert.notEqual(separate.data.id,results[0].data.id);
  const second=createApp(options),listener=second.listen(0,'127.0.0.1');await new Promise(resolve=>listener.once('listening',resolve));
  try {
    const retried=await call('POST','/projects',{name:'One project',parentId:null},owner,headers,'http://127.0.0.1:'+listener.address().port);
    assert.equal(retried.status,201);assert.equal(retried.data.id,results[0].data.id);
  } finally {await new Promise(resolve=>listener.close(resolve));second.locals.db.close();}
});

test('multipart retries create one work and one copy of each upload, and failed attempts remain retryable',async()=>{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2uoAAAAASUVORK5CYII=','base64');
  const form=(cover=png,attachment='same bytes')=>{
    const data=new FormData();for(const [name,value] of Object.entries(body('Retried upload')))data.set(name,String(value));
    data.set('cover',new Blob([cover],{type:'image/png'}),'cover.png');data.set('attachment',new Blob([attachment],{type:'text/plain'}),'notes.txt');return data;
  };
  const headers=key(),before=fs.readdirSync(options.uploadsDir).length;
  const results=await Promise.all([call('POST','/works',form(),owner,headers),call('POST','/works',form(),owner,headers)]);
  assert(results.every(result=>result.status===201));assert.equal(results[0].data.id,results[1].data.id);
  assert.equal(fs.readdirSync(options.uploadsDir).length,before+2);
  assert.equal((await call('POST','/works',form(png,'changed bytes'),owner,headers)).status,409);
  const quota=app.locals.config.projectFileQuotaBytes;app.locals.config.projectFileQuotaBytes=1;
  try {assert.equal((await call('POST','/works',form(),owner,headers)).status,201);} finally {app.locals.config.projectFileQuotaBytes=quota;}
  const retryable=key();assert.equal((await call('POST','/works',form(Buffer.from('bad image')),owner,retryable)).status,400);
  assert.equal((await call('POST','/works',form(),owner,retryable)).status,201);
  await call('DELETE',route(results[0].data));
  assert.equal((await call('POST','/works',form(),owner,headers)).status,410);
});

test('report retries cannot duplicate a submission or bypass revoked access',async()=>{
  const work=await newWork('Report retries'),url=route(work)+'/reports',headers=key();
  const results=await Promise.all([call('POST',url,{text:'Saved once'},member,headers),call('POST',url,{text:'Saved once'},member,headers)]);
  assert(results.every(result=>result.status===201));assert.equal(results[0].data.id,results[1].data.id);
  assert.equal((await call('GET',url)).data.length,1);
  assert.equal((await call('POST',url,{text:'Changed'},member,headers)).status,409);
  assert.equal((await call('POST',url,{text:'Saved once'},member,key())).status,201);
  const retryable=key();assert.equal((await call('POST',url,{text:''},member,retryable)).status,400);
  assert.equal((await call('POST',url,{text:'Corrected after validation'},member,retryable)).status,201);
  await call('DELETE','/projects/'+project.id+'/members/'+member.user.id);
  assert.equal((await call('POST',url,{text:'Saved once'},member,headers)).status,404);
  await call('POST','/projects/'+project.id+'/members',{identifier:member.user.username});
  await call('DELETE',url+'/'+results[0].data.id);
  assert.equal((await call('POST',url,{text:'Saved once'},member,headers)).status,410);
});

test('stale work, status and assignment writes cannot replace a newer version or write stale files',async()=>{
  const work=await newWork('Concurrent work'),url=route(work);
  assert.equal((await call('PATCH',url,body('No version'))).status,428);
  const writes=await Promise.all([call('PATCH',url,body('First editor'),owner,version(work)),call('PATCH',url,body('Second editor'),owner,version(work))]);
  assert.deepEqual(writes.map(result=>result.status).sort(),[200,412]);
  const current=(await call('GET',url)).data;
  assert.equal((await call('PATCH',url+'/status',{status:'done'},owner,version(work))).status,412);
  assert.equal((await call('PUT',url+'/assignees',{userIds:[member.user.id]},owner,version(work))).status,412);
  const form=new FormData();for(const [name,value] of Object.entries(body('Stale upload')))form.set(name,String(value));
  form.set('attachment',new Blob(['stale upload']),'stale.txt');
  const files=fs.readdirSync(options.uploadsDir).length;
  assert.equal((await call('PATCH',url,form,owner,version(work))).status,412);
  assert.equal(fs.readdirSync(options.uploadsDir).length,files);
  const assignments=await Promise.all([call('PUT',url+'/assignees',{userIds:[member.user.id]},owner,version(current)),call('PUT',url+'/assignees',{userIds:[other.user.id]},owner,version(current))]);
  assert.deepEqual(assignments.map(result=>result.status).sort(),[200,412]);
  const saved=(await call('GET',url)).data;
  assert.equal(saved.assignees.length,1);assert.equal(saved.title,current.title);assert.equal(saved.status,'in_progress');
});

test('report edits reject stale versions while preserving the newer text and permissions',async()=>{
  const work=await newWork('Concurrent reports'),url=route(work)+'/reports';
  const report=(await call('POST',url,{text:'Original'},member)).data;
  assert.equal((await call('PATCH',url+'/'+report.id,{text:'No version'},member)).status,428);
  assert.equal((await call('PATCH',url+'/'+report.id,{text:'Forbidden'},other,version(report))).status,403);
  const writes=await Promise.all([call('PATCH',url+'/'+report.id,{text:'First edit'},member,version(report)),call('PATCH',url+'/'+report.id,{text:'Second edit'},owner,version(report))]);
  assert.deepEqual(writes.map(result=>result.status).sort(),[200,412]);
  const current=(await call('GET',url)).data[0];assert.equal(current.text,writes.find(result=>result.status===200).data.text);
  const repeated=await call('PATCH',url+'/'+report.id,{text:current.text},member,version(current));
  assert.equal(repeated.status,200);assert.notEqual(repeated.data.version,current.version);
  assert(Date.parse(repeated.data.updatedAt)>Date.parse(current.updatedAt));
  assert.equal((await call('PATCH',url+'/'+report.id,{text:'Stale again'},member,version(current))).status,412);
});
