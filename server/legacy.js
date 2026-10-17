import fs from 'node:fs';
import path from 'node:path';
import { id,now,text,fail } from './domain.js';
import { transaction } from './db.js';
import { imageMime,insertFile,removeFiles } from './files.js';

export function importLegacy(db,ownerId,source,config) {
  if(!db.prepare('SELECT 1 FROM users WHERE id=?').get(ownerId)) fail(400,'مالک ثبت‌شده پیدا نشد.');
  if(db.prepare('SELECT 1 FROM projects LIMIT 1').get()) fail(409,'انتقال فقط به دیتابیس بدون پروژه مجاز است.');
  const data=JSON.parse(fs.readFileSync(source,'utf8'));
  if(!Array.isArray(data.projects) || !Array.isArray(data.works)) fail(400,'ساختار فایل قدیمی معتبر نیست.');
  const remaining=new Map();
  for(const p of data.projects) {
    const projectId=text(String(p.id),'شناسه پروژه',100);
    if(remaining.has(projectId)) fail(400,'شناسه تکراری پروژه در فایل قدیمی.');
    remaining.set(projectId,p);
  }
  const added=[],warnings=[],projectMap=new Map();
  fs.mkdirSync(config.uploadsDir,{recursive:true,mode:0o700});
  try {
    transaction(db,()=>{
      while(remaining.size) {
        let progress=false;
        for(const [projectId,p] of remaining) {
          const parentId=p.parentId==null ? null : String(p.parentId),parent=projectMap.get(parentId);
          if(parentId && !parent)continue;
          const project={id:projectId,name:text(p.name,'نام پروژه'),parentId,rootId:parent?.rootId || projectId};
          db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run(project.id,project.name,parentId,project.rootId,ownerId,now());
          projectMap.set(projectId,project);remaining.delete(projectId);progress=true;
        }
        if(!progress)fail(400,'پروژه‌ی والد ناموجود یا حلقه در ساختار قدیمی.');
      }
      for(const w of data.works) {
        const projectId=String(w.projectId || '');
        if(!projectMap.has(projectId))fail(400,`پروژه‌ی کار ${w.id} پیدا نشد.`);
        const floor=Number(w.floorNum);
        if(!Number.isInteger(floor) || floor<1 || floor>7)fail(400,`طبقه‌ی کار ${w.id} معتبر نیست.`);
        const number=db.prepare(`INSERT INTO work_sequences VALUES(?,?,1) ON CONFLICT(project_id,floor_num)
          DO UPDATE SET last_number=last_number+1 RETURNING last_number`).get(projectId,floor).last_number;
        const workId=text(String(w.id),'شناسه کار',200),date=now();
        db.prepare('INSERT INTO works VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(workId,text(w.title,'عنوان کار'),projectId,floor,number,
          text(w.summary,'توضیحات',10000,false),text(w.prerequisite,'پیش‌نیاز',10000,false),w.status==='done' ? 'done' : 'in_progress',ownerId,
          typeof w.createdAt==='string' && !Number.isNaN(Date.parse(w.createdAt)) ? w.createdAt : date,date);
        for(const kind of ['cover','attachment']) {
          const raw=w[kind+'Path'];if(!raw)continue;
          const filename=String(raw).replaceAll('\\','/').split('/').at(-1);
          if(!/^[a-zA-Z0-9_-]+$/.test(filename))fail(400,'مسیر فایل قدیمی معتبر نیست.');
          const input=path.join(path.dirname(source),'uploads',filename);
          if(!fs.existsSync(input)){warnings.push(`فایل موجود نیست: ${workId} / ${kind} / ${filename}`);continue;}
          const root=fs.realpathSync(path.join(path.dirname(source),'uploads'))+path.sep;
          if(!fs.realpathSync(input).startsWith(root))fail(400,'فایل قدیمی خارج از uploads است.');
          const buffer=fs.readFileSync(input),mime=kind==='cover' ? imageMime(buffer) : 'application/octet-stream';
          if(!mime){warnings.push(`کاور نامعتبر منتقل نشد: ${workId}`);continue;}
          const file={id:id(),workId,kind,filename:id(),name:filename,mime,size:buffer.length};
          fs.writeFileSync(path.join(config.uploadsDir,file.filename),buffer,{flag:'wx',mode:0o600});
          added.push(file);insertFile(db,file);
        }
      }
    });
  }catch(error){removeFiles(config,added);throw error;}
  return {projects:projectMap.size,works:data.works.length,files:added.length,warnings};
}
