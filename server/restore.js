import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { id } from './domain.js';
import { openDatabase } from './db.js';

export function restoreBackup(source,config,replace=false) {
  const sourceFile=path.resolve(source,'building.sqlite'),sourceUploads=path.resolve(source,'uploads');
  if(!fs.existsSync(sourceFile))throw new Error('Backup building.sqlite is missing.');
  if(fs.existsSync(sourceFile+'-wal'))throw new Error('Use an offline backup, not a running database with a WAL file.');
  const snapshot=new DatabaseSync(sourceFile,{readOnly:true});
  let files;
  try {
    if(snapshot.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Backup integrity check failed.');
    if(snapshot.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Backup foreign keys are invalid.');
    if(!snapshot.prepare('SELECT 1 FROM schema_versions WHERE version=1').get())throw new Error('Unsupported backup schema.');
    files=snapshot.prepare('SELECT filename FROM files').all();
    for(const file of files) {
      if(!/^[a-f0-9-]{36}$/.test(file.filename))throw new Error('Unsafe filename in backup.');
      const input=path.join(sourceUploads,file.filename);
      if(!fs.existsSync(input) || !fs.statSync(input).isFile())throw new Error('Backup upload missing: '+file.filename);
      if(!fs.realpathSync(input).startsWith(fs.realpathSync(sourceUploads)+path.sep))throw new Error('Upload escapes backup directory.');
    }
  } finally {snapshot.close();}
  const directory=path.resolve(config.dataDir);
  if(path.dirname(path.resolve(config.databasePath))!==directory || path.dirname(path.resolve(config.uploadsDir))!==directory)
    throw new Error('Database and uploads must be direct children of DATA_DIR for restore.');
  const populated=fs.existsSync(config.databasePath) || (fs.existsSync(config.uploadsDir) && fs.readdirSync(config.uploadsDir).length>0);
  if(populated && !replace)throw new Error('Existing data found. Back it up first, then use --replace while the app is stopped.');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const staging=path.join(directory,'restore-stage-'+id());
  fs.mkdirSync(staging,{mode:0o700});
  const stagedDatabase=path.join(staging,'building.sqlite'),stagedUploads=path.join(staging,'uploads');
  try {
    fs.copyFileSync(sourceFile,stagedDatabase);
    fs.mkdirSync(stagedUploads,{mode:0o700});
    for(const file of files)fs.copyFileSync(path.join(sourceUploads,file.filename),path.join(stagedUploads,file.filename));
    const incoming=openDatabase(stagedDatabase);
    incoming.prepare('DELETE FROM sessions').run();incoming.close();
    let retired=null;
    if(populated) {
      retired=path.join(directory,'retired-'+id());fs.mkdirSync(retired,{mode:0o700});
      for(const suffix of ['','-wal','-shm']) {
        const existing=config.databasePath+suffix;
        if(fs.existsSync(existing))fs.renameSync(existing,path.join(retired,'building.sqlite'+suffix));
      }
      if(fs.existsSync(config.uploadsDir))fs.renameSync(config.uploadsDir,path.join(retired,'uploads'));
    } else if(fs.existsSync(config.uploadsDir))fs.rmdirSync(config.uploadsDir);
    fs.renameSync(stagedDatabase,config.databasePath);fs.renameSync(stagedUploads,config.uploadsDir);
    return {files:files.length,retired,sessionsRevoked:true};
  } finally {fs.rmSync(staging,{recursive:true,force:true});}
}
