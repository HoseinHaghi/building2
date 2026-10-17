import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { configuration,serverDir } from '../config.js';
import { openDatabase } from '../db.js';
import { seedOriginalPreview } from '../preview.js';

const args=process.argv.slice(2),ownerIndex=args.indexOf('--owner');
let db;
try {
  if(ownerIndex<0 || !args[ownerIndex+1])throw new Error('Usage: node server/scripts/seed-original-preview.js --owner username [--apply]');
  const config=configuration();
  if(config.production)throw new Error('Original preview data is only available in local development.');
  if(!fs.existsSync(config.databasePath))throw new Error('Create the requested owner account first.');
  const apply=args.includes('--apply');
  db=apply ? openDatabase(config.databasePath) : new DatabaseSync(config.databasePath,{readOnly:true});
  const owner=db.prepare('SELECT id,username FROM users WHERE username=?').get(args[ownerIndex+1].toLowerCase());
  if(!owner)throw new Error('The requested owner username does not exist.');
  const fixture=JSON.parse(fs.readFileSync(path.join(serverDir,'fixtures/original-preview.json'),'utf8'));
  const result=apply ? await seedOriginalPreview(db,owner.id,fixture,config,path.join(serverDir,'uploads')) : {
    dryRun:true,owner:owner.username,legacyProjects:fixture.legacy.projects.length,
    legacyWorks:fixture.legacy.works.length,taskCards:fixture.tasks.length,
    boardWorks:fixture.board.rows.reduce((count,row)=>count+row.bubbles+row.more,0),
  };
  console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.message);process.exitCode=1;}finally{db?.close();}
