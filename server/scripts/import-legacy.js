import path from 'node:path';
import { configuration,serverDir } from '../config.js';
import { openDatabase } from '../db.js';
import { importLegacy } from '../legacy.js';
const config=configuration(),db=openDatabase(config.databasePath);
try {
  const args=process.argv.slice(2),owner=args[args.indexOf('--owner')+1];
  if(!args.includes('--owner') || !owner)throw new Error('Usage: npm run import:legacy -- --owner username [--source /path/data.json]');
  const user=db.prepare('SELECT id FROM users WHERE username=? OR email=?').get(owner.toLowerCase(),owner.toLowerCase());
  if(!user)throw new Error('Create the owner account first. Demo accounts are never imported.');
  const source=args.includes('--source') ? path.resolve(args[args.indexOf('--source')+1]) : path.join(serverDir,'data.json');
  console.log(JSON.stringify(importLegacy(db,user.id,source,config),null,2));
}catch(error){console.error(error.message);process.exitCode=1;}finally{db.close();}
