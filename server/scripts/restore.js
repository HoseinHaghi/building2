import path from 'node:path';
import { configuration } from '../config.js';
import { restoreBackup } from '../restore.js';
try {
  const args=process.argv.slice(2),index=args.indexOf('--source');
  if(index<0 || !args[index+1])throw new Error('Stop the app, then: node scripts/restore.js --source /absolute/backup-directory [--replace]');
  console.log(JSON.stringify(restoreBackup(path.resolve(args[index+1]),configuration(),args.includes('--replace')),null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
