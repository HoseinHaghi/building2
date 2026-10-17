import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { backup } from 'node:sqlite';
import { openDatabase } from '../db.js';
import { restoreBackup } from '../restore.js';
test('backup restores persisted rows, archives replaced data and revokes sessions',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'building-restore-')),source=path.join(dir,'backup'),target=path.join(dir,'target');
  fs.mkdirSync(source);fs.mkdirSync(path.join(source,'uploads'));
  const db=openDatabase(':memory:');
  try {
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run('user','User','user','user@example.test','hash','2026-01-01');
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run('hash','user','csrf',Date.now()+10000);
    await backup(db,path.join(source,'building.sqlite'));
    const config={dataDir:target,databasePath:path.join(target,'building.sqlite'),uploadsDir:path.join(target,'uploads')};
    const result=restoreBackup(source,config);
    assert.equal(result.sessionsRevoked,true);
    const restored=openDatabase(config.databasePath);
    assert.equal(restored.prepare('SELECT count(*) AS n FROM users').get().n,1);
    assert.equal(restored.prepare('SELECT count(*) AS n FROM sessions').get().n,0);restored.close();
    assert.throws(()=>restoreBackup(source,config),/Existing data/);
    const replaced=restoreBackup(source,config,true);
    assert.ok(fs.existsSync(path.join(replaced.retired,'building.sqlite')));
  } finally {db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
