import { Router } from 'express';
import { id,now,text,fail,accessProject,accessWork,projectMembers,serializeWork,serializeReport } from '../domain.js';
import { transaction } from '../db.js';
import { uploadMiddleware,storeUpload,insertFile,removeFiles,checkStorageQuota } from '../files.js';

export function workRoutes(db,config) {
  const router=Router(),upload=uploadMiddleware(config);
  const fields=body=>{
    const title=text(body.title,'عنوان کار');
    const floorNum=Number(body.floorNum);
    if(!Number.isInteger(floorNum) || floorNum<1 || floorNum>7) fail(400,'طبقه باید عددی بین ۱ تا ۷ باشد.');
    return { title,floorNum,summary:text(body.summary,'توضیحات',10000,false),prerequisite:text(body.prerequisite,'پیش‌نیاز',10000,false) };
  };
  router.get('/works',(req,res)=>{
    const where=[`(p.owner_id=? OR EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=p.root_id AND m.user_id=?))`];
    const params=[req.user.id,req.user.id];
    if(req.query.status) {
      if(!['done','in_progress'].includes(req.query.status)) fail(400,'وضعیت کار معتبر نیست.');
      where.push('w.status=?'); params.push(req.query.status);
    }
    let subtree='';
    if(req.query.projectId) {
      const p=accessProject(db,String(req.query.projectId),req.user.id);
      subtree='WITH RECURSIVE subtree(id) AS (SELECT ? UNION ALL SELECT p.id FROM projects p JOIN subtree s ON p.parent_id=s.id) ';
      params.unshift(p.id); where.push('w.project_id IN (SELECT id FROM subtree)');
    }
    if(req.query.mine==='true') {
      where.push('(w.creator_id=? OR EXISTS(SELECT 1 FROM work_assignees a WHERE a.work_id=w.id AND a.user_id=?))');
      params.push(req.user.id,req.user.id);
    }
    if(req.query.floorNum) {
      const floor=Number(req.query.floorNum);
      if(!Number.isInteger(floor) || floor<1 || floor>7) fail(400,'طبقه معتبر نیست.');
      where.push('w.floor_num=?'); params.push(floor);
    }
    if(req.query.q) {
      const search=text(req.query.q,'جست‌وجو',100).replace(/[\\%_]/g,'\\$&');
      where.push("w.title LIKE ? ESCAPE '\\'"); params.push(`%${search}%`);
    }
    const page=Number(req.query.page || 1),limit=Number(req.query.limit || 50);
    if(!Number.isInteger(page) || page<1 || page>100000 || !Number.isInteger(limit) || limit<1 || limit>100) fail(400,'صفحه‌بندی معتبر نیست.');
    const base=` FROM works w JOIN projects p ON p.id=w.project_id WHERE ${where.join(' AND ')}`;
    const total=db.prepare(subtree+'SELECT count(*) AS total'+base).get(...params).total;
    const items=db.prepare(subtree+'SELECT w.*'+base+' ORDER BY w.created_at DESC,w.id LIMIT ? OFFSET ?').all(...params,limit,(page-1)*limit);
    res.json({ items:items.map(w=>serializeWork(db,w,req.user.id)),total,page,limit });
  });
  router.post('/works',upload,(req,res)=>{
    const values=fields(req.body);
    const p=accessProject(db,text(req.body.projectId,'پروژه',100),req.user.id);
    checkStorageQuota(db,config,p,req.files);
    const newFiles=[];
    let workId;
    try {
      transaction(db,()=>{
        const sequence=db.prepare(`INSERT INTO work_sequences VALUES(?,?,1) ON CONFLICT(project_id,floor_num)
          DO UPDATE SET last_number=last_number+1 RETURNING last_number`).get(p.id,values.floorNum).last_number;
        workId=`${p.id}:${values.floorNum}:${sequence}`;
        const date=now();
        db.prepare('INSERT INTO works VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(workId,values.title,p.id,values.floorNum,sequence,values.summary,values.prerequisite,'in_progress',req.user.id,date,date);
        for(const kind of ['cover','attachment']) {
          const file=storeUpload(config,req.files?.[kind]?.[0],workId,kind);
          if(file) { newFiles.push(file); insertFile(db,file); }
        }
      });
    } catch(error) { removeFiles(config,newFiles); throw error; }
    res.status(201).json(serializeWork(db,db.prepare('SELECT * FROM works WHERE id=?').get(workId),req.user.id));
  });
  router.get('/works/:id',(req,res)=>{
    const {work}=accessWork(db,req.params.id,req.user.id);
    res.json(serializeWork(db,work,req.user.id));
  });
  router.patch('/works/:id',upload,(req,res)=>{
    const {work,project}=accessWork(db,req.params.id,req.user.id,true),values=fields(req.body);
    checkStorageQuota(db,config,project,req.files,work.id);
    // Moving a work to another project would silently transfer private reports and files.
    if(req.body.projectId && req.body.projectId!==work.project_id) fail(400,'پروژه‌ی کار پس از ایجاد قابل تغییر نیست.');
    const newFiles=[],retired=[];
    try {
      transaction(db,()=>{
        let number=work.number;
        if(values.floorNum!==work.floor_num) number=db.prepare(`INSERT INTO work_sequences VALUES(?,?,1)
          ON CONFLICT(project_id,floor_num) DO UPDATE SET last_number=last_number+1 RETURNING last_number`).get(work.project_id,values.floorNum).last_number;
        db.prepare('UPDATE works SET title=?,floor_num=?,number=?,summary=?,prerequisite=?,updated_at=? WHERE id=?')
          .run(values.title,values.floorNum,number,values.summary,values.prerequisite,now(),work.id);
        for(const kind of ['cover','attachment']) {
          const incoming=req.files?.[kind]?.[0];
          const remove=req.body[kind==='cover' ? 'removeCover' : 'removeAttachment']==='true';
          if(incoming || remove) {
            retired.push(...db.prepare('SELECT * FROM files WHERE work_id=? AND kind=?').all(work.id,kind));
            db.prepare('DELETE FROM files WHERE work_id=? AND kind=?').run(work.id,kind);
            const file=storeUpload(config,incoming,work.id,kind);
            if(file) { newFiles.push(file); insertFile(db,file); }
          }
        }
      });
    } catch(error) { removeFiles(config,newFiles); throw error; }
    removeFiles(config,retired);
    res.json(serializeWork(db,db.prepare('SELECT * FROM works WHERE id=?').get(work.id),req.user.id));
  });
  router.patch('/works/:id/status',(req,res)=>{
    const {work}=accessWork(db,req.params.id,req.user.id);
    if(!work.can_change_status) fail(403,'تغییر وضعیت فقط برای مالک، ایجادکننده یا مسئول کار مجاز است.');
    if(!['in_progress','done'].includes(req.body.status)) fail(400,'وضعیت کار معتبر نیست.');
    db.prepare('UPDATE works SET status=?,updated_at=? WHERE id=?').run(req.body.status,now(),work.id);
    res.json(serializeWork(db,db.prepare('SELECT * FROM works WHERE id=?').get(work.id),req.user.id));
  });
  router.delete('/works/:id',(req,res)=>{
    const {work}=accessWork(db,req.params.id,req.user.id,true);
    const files=db.prepare('SELECT * FROM files WHERE work_id=?').all(work.id);
    db.prepare('DELETE FROM works WHERE id=?').run(work.id);
    removeFiles(config,files); res.status(204).end();
  });
  router.put('/works/:id/assignees',(req,res)=>{
    const {work,project}=accessWork(db,req.params.id,req.user.id,true);
    const ids=req.body.userIds;
    if(!Array.isArray(ids) || ids.length>50 || ids.some(uid=>typeof uid!=='string')) fail(400,'فهرست مسئولان معتبر نیست.');
    const members=new Set(projectMembers(db,project).map(u=>u.id));
    if(ids.some(uid=>!members.has(uid))) fail(400,'مسئول کار باید عضو پروژه باشد.');
    transaction(db,()=>{
      db.prepare('DELETE FROM work_assignees WHERE work_id=?').run(work.id);
      const insert=db.prepare('INSERT INTO work_assignees VALUES(?,?)');
      for(const uid of new Set(ids)) insert.run(work.id,uid);
      db.prepare('UPDATE works SET updated_at=? WHERE id=?').run(now(),work.id);
    });
    res.json(serializeWork(db,db.prepare('SELECT * FROM works WHERE id=?').get(work.id),req.user.id));
  });
  router.get('/works/:id/reports',(req,res)=>{
    const {work,project}=accessWork(db,req.params.id,req.user.id);
    res.json(db.prepare('SELECT * FROM reports WHERE work_id=? ORDER BY created_at,id').all(work.id).map(r=>serializeReport(db,r,req.user.id,project.owner_id)));
  });
  router.post('/works/:id/reports',(req,res)=>{
    const {work,project}=accessWork(db,req.params.id,req.user.id);
    const reportId=id(),date=now(),body=text(req.body.text,'گزارش',10000);
    db.prepare('INSERT INTO reports VALUES(?,?,?,?,?,?)').run(reportId,work.id,req.user.id,body,date,date);
    res.status(201).json(serializeReport(db,db.prepare('SELECT * FROM reports WHERE id=?').get(reportId),req.user.id,project.owner_id));
  });
  const reportAccess=req=>{
    const {work,project}=accessWork(db,req.params.id,req.user.id);
    const report=db.prepare('SELECT * FROM reports WHERE id=? AND work_id=?').get(req.params.reportId,work.id);
    if(!report) fail(404,'گزارش یافت نشد.');
    if(report.author_id!==req.user.id && project.owner_id!==req.user.id) fail(403,'ویرایش گزارش برای شما مجاز نیست.');
    return {report,project};
  };
  router.patch('/works/:id/reports/:reportId',(req,res)=>{
    const {report,project}=reportAccess(req);
    db.prepare('UPDATE reports SET text=?,updated_at=? WHERE id=?').run(text(req.body.text,'گزارش',10000),now(),report.id);
    res.json(serializeReport(db,db.prepare('SELECT * FROM reports WHERE id=?').get(report.id),req.user.id,project.owner_id));
  });
  router.delete('/works/:id/reports/:reportId',(req,res)=>{
    const {report}=reportAccess(req); db.prepare('DELETE FROM reports WHERE id=?').run(report.id); res.status(204).end();
  });
  return router;
}
