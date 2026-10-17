import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { id,fail } from './domain.js';

export function uploadMiddleware(config) {
  return multer({ storage:multer.memoryStorage(),limits:{ fileSize:config.maxFileBytes,files:2,fields:12,parts:14,fieldSize:20000 } })
    .fields([{name:'cover',maxCount:1},{name:'attachment',maxCount:1}]);
}
export function imageMime(buffer) {
  if(buffer.length>=8 && buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if(buffer.length>=3 && buffer[0]===255 && buffer[1]===216 && buffer[2]===255) return 'image/jpeg';
  if(buffer.length>=12 && buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP') return 'image/webp';
  return null;
}
export function checkStorageQuota(db,config,project,files,workId=null) {
  const incoming=Object.values(files || {}).flat().reduce((sum,file)=>sum+file.size,0);
  if(!incoming)return;
  const used=db.prepare(`SELECT coalesce(sum(f.size),0) AS bytes FROM files f
    JOIN works w ON w.id=f.work_id JOIN projects p ON p.id=w.project_id WHERE p.root_id=?`).get(project.root_id).bytes;
  let replaced=0;
  if(workId)for(const kind of Object.keys(files))replaced+=db.prepare('SELECT coalesce(sum(size),0) AS bytes FROM files WHERE work_id=? AND kind=?').get(workId,kind).bytes;
  if(used-replaced+incoming>config.projectFileQuotaBytes)fail(413,'فضای فایل‌های این پروژه پر شده است (حداکثر ۵۰۰ مگابایت).');
  const disk=fs.statfsSync(config.uploadsDir);
  if(disk.bavail*disk.bsize<config.minimumFreeBytes+incoming)fail(507,'فضای ذخیره‌سازی سرور کافی نیست.');
}
export function storeUpload(config,file,workId,kind) {
  if(!file) return null;
  if(!file.size) fail(400,'فایل خالی قابل بارگذاری نیست.');
  const mime=kind==='cover' ? imageMime(file.buffer) : 'application/octet-stream';
  if(!mime) fail(400,'تصویر کاور باید PNG، JPEG یا WebP باشد.');
  const filename=id();
  let original=file.originalname;
  if ([...original].every(c=>c.charCodeAt(0)<=255)) {
    try { original=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(original,'latin1')); } catch { /* Already decoded or a legacy filename. */ }
  }
  original=[...original].map(c=>c==='/' || c==='\\' || c.charCodeAt(0)<32 || c.charCodeAt(0)===127 ? '_' : c).join('').slice(0,160) || 'file';
  const record={ id:id(),workId,kind,filename,name:original,mime,size:file.size };
  fs.writeFileSync(path.join(config.uploadsDir,filename),file.buffer,{flag:'wx',mode:0o600});
  return record;
}
export function insertFile(db,file) {
  if(file) db.prepare('INSERT INTO files VALUES(?,?,?,?,?,?,?)').run(file.id,file.workId,file.kind,file.filename,file.name,file.mime,file.size);
}
export function removeFiles(config,files) {
  for(const file of files) {
    try { fs.unlinkSync(path.join(config.uploadsDir,file.filename)); }
    catch(error) { if(error.code!=='ENOENT') console.error('Unable to remove retired upload',error.code); }
  }
}
