import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase } from '../db.js';
import { configuration } from '../config.js';
import { seedOriginalPreview } from '../preview.js';
import { accessWork } from '../domain.js';

function setup() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'building-preview-')),db=openDatabase(':memory:');
  for(const user of ['owner','outsider'])db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(user,user,user,null,'existing-hash','2026-01-01');
  for(const user of ['owner','outsider'])db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run(user+'-existing','Existing',null,user+'-existing',user,'2026-01-01');
  db.prepare('INSERT INTO works VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('existing-work','Personal work','owner-existing',1,1,'keep','keep','done','owner','2026-01-01','2026-01-01');
  const legacyUploads=path.join(directory,'legacy');fs.mkdirSync(legacyUploads);
  fs.writeFileSync(path.join(legacyUploads,'oldfile'),'Original attachment');
  const config=configuration({production:false,databasePath:':memory:',uploadsDir:path.join(directory,'uploads'),minimumFreeBytes:0});
  const fixture={version:'test-original-v1',legacy:{projects:[{id:'root',name:'Sample root',parentId:null}],
    works:[{title:'Old work',projectId:'root',floorNum:1,status:'done',attachmentPath:'uploads/oldfile',coverPath:'uploads/missing'}]},
    tasks:[{title:'Old card',floorNum:3,projectPath:['Sample root','Child'],status:'done'}],
    board:{projectPath:['Sample root','Board'],rows:[{id:2,label:'Floor 2',bubbles:1,more:1}]},
    assigneeNames:['Original responsible'],reports:[{author:'Original writer',text:'Original report'}]};
  return {db,directory,legacyUploads,config,fixture};
}

test('original preview adds private owner data, retains personal data and skips repeated imports',async()=>{
  const {db,directory,legacyUploads,config,fixture}=setup();
  try {
    const before=db.prepare("SELECT * FROM users WHERE id IN ('owner','outsider') ORDER BY id").all();
    const result=await seedOriginalPreview(db,'owner',fixture,config,legacyUploads);
    assert.equal(result.projects,3);assert.equal(result.works,4);assert.equal(result.reports,4);assert.equal(result.files,1);
    assert.equal(result.warnings.length,1);assert.equal(result.alreadyImported,false);
    assert.deepEqual(db.prepare("SELECT * FROM users WHERE id IN ('owner','outsider') ORDER BY id").all(),before);
    assert.equal(db.prepare("SELECT summary FROM works WHERE id='existing-work'").get().summary,'keep');
    assert.equal(db.prepare("SELECT count(*) AS n FROM project_members WHERE project_id IN ('owner-existing','outsider-existing')").get().n,0);
    const work=db.prepare('SELECT * FROM works WHERE project_id=?').get(result.boardProjectId);
    assert.ok(db.prepare('SELECT created_at FROM works WHERE title=?').get('Old card').created_at>work.created_at);
    assert.equal(accessWork(db,work.id,'owner').work.can_edit,true);
    assert.throws(()=>accessWork(db,work.id,'outsider'),/یافت نشد/);
    assert.equal(db.prepare('SELECT count(*) AS n FROM work_assignees WHERE work_id=?').get(work.id).n,1);
    const file=db.prepare('SELECT filename FROM files').get();
    assert.equal(fs.readFileSync(path.join(config.uploadsDir,file.filename),'utf8'),'Original attachment');
    db.prepare('UPDATE works SET title=? WHERE id=?').run('Personal edit',work.id);
    const repeated=await seedOriginalPreview(db,'owner',fixture,config,legacyUploads);
    assert.equal(repeated.alreadyImported,true);
    assert.equal(db.prepare('SELECT title FROM works WHERE id=?').get(work.id).title,'Personal edit');
    assert.equal(db.prepare('SELECT count(*) AS n FROM works').get().n,5);
    assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n,4);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  }finally{db.close();fs.rmSync(directory,{recursive:true,force:true});}
});

test('a failed preview import rolls back new people, projects, reports and copied uploads',async()=>{
  const {db,directory,legacyUploads,config,fixture}=setup();
  try {
    fixture.tasks[0].floorNum=99;
    await assert.rejects(seedOriginalPreview(db,'owner',fixture,config,legacyUploads),/Invalid sample work floor/);
    assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n,2);
    assert.equal(db.prepare('SELECT count(*) AS n FROM projects').get().n,2);
    assert.equal(db.prepare('SELECT count(*) AS n FROM works').get().n,1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM reports').get().n,0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM original_preview_imports').get().n,0);
    assert.deepEqual(fs.readdirSync(config.uploadsDir),[]);
    await assert.rejects(seedOriginalPreview(db,'owner',fixture,{...config,production:true},legacyUploads),/local development/);
  }finally{db.close();fs.rmSync(directory,{recursive:true,force:true});}
});
