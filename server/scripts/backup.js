import fs from 'node:fs';
import path from 'node:path';
import { backup } from 'node:sqlite';
import { configuration } from '../config.js';
import { openDatabase } from '../db.js';
const config=configuration(),db=openDatabase(config.databasePath);
try {
  const index=process.argv.indexOf('--output');
  if(index<0 || !process.argv[index+1])throw new Error('Stop the app first, then: npm run backup -- --output /absolute/new-backup-directory');
  const target=path.resolve(process.argv[index+1]);
  if(fs.existsSync(target))throw new Error('Backup target already exists; choose a new directory.');
  fs.mkdirSync(target,{recursive:true,mode:0o700});
  await backup(db,path.join(target,'building.sqlite'));fs.chmodSync(path.join(target,'building.sqlite'),0o600);
  if(fs.existsSync(config.uploadsDir))fs.cpSync(config.uploadsDir,path.join(target,'uploads'),{recursive:true});
  const schemaVersion=db.prepare('SELECT MAX(version) AS version FROM schema_versions').get().version;
  fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify({schemaVersion,createdAt:new Date().toISOString()},null,2));
  console.log('Backup created at '+target);
}catch(error){console.error(error.message);process.exitCode=1;}finally{db.close();}
