import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../db.js';
import { importLegacy } from '../legacy.js';
test('legacy import preserves hierarchy and ids without importing demo credentials',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'building-import-')),db=openDatabase(':memory:');
  try{
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run('owner','Owner','owner','owner@example.test','unused','2026-01-01');
    fs.mkdirSync(path.join(dir,'uploads'));fs.writeFileSync(path.join(dir,'uploads','existingfile'),'attachment');
    const source=path.join(dir,'data.json');
    fs.writeFileSync(source,JSON.stringify({users:[{email:'demo@example.com',password:'123456'}],
      projects:[{id:'1-1',name:'Child',parentId:'1'},{id:'1',name:'Root',parentId:null}],
      works:[{id:'1-1:2:1',title:'Legacy',projectId:'1-1',floorNum:2,status:'done',summary:'saved',
        coverPath:'uploads/missing',attachmentPath:'uploads/existingfile'}]}));
    const result=importLegacy(db,'owner',source,{uploadsDir:path.join(dir,'new-uploads')});
    assert.equal(result.projects,2);assert.equal(result.works,1);assert.equal(result.files,1);assert.equal(result.warnings.length,1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n,1);
    assert.equal(db.prepare('SELECT root_id FROM projects WHERE id=?').get('1-1').root_id,'1');
    assert.equal(db.prepare('SELECT summary FROM works WHERE id=?').get('1-1:2:1').summary,'saved');
    assert.throws(()=>importLegacy(db,'owner',source,{uploadsDir:path.join(dir,'new-uploads')}),/بدون پروژه/);
  }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('invalid legacy hierarchy rolls back the entire import',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'building-invalid-')),db=openDatabase(':memory:');
  try{
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run('owner','Owner','owner','owner@example.test','unused','2026-01-01');
    const source=path.join(dir,'data.json');
    fs.writeFileSync(source,JSON.stringify({projects:[{id:'root',name:'Valid'},{id:'child',name:'Invalid',parentId:'absent'}],works:[]}));
    assert.throws(()=>importLegacy(db,'owner',source,{uploadsDir:path.join(dir,'uploads')}),/والد/);
    assert.equal(db.prepare('SELECT count(*) AS n FROM projects').get().n,0);
  }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
