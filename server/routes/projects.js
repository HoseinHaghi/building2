import { Router } from 'express';
import { id,now,text,fail,accessProject,projectMembers,serializeProject } from '../domain.js';
import { transaction } from '../db.js';

export function projectRoutes(db) {
  const router=Router();
  const list=userId=>db.prepare(`SELECT p.* FROM projects p WHERE p.owner_id=? OR EXISTS
    (SELECT 1 FROM project_members m WHERE m.project_id=p.root_id AND m.user_id=?) ORDER BY p.created_at,p.id`).all(userId,userId);
  router.get('/projects',(req,res)=>res.json(list(req.user.id).map(p=>serializeProject(db,p,req.user.id))));
  router.get('/projects/roots',(req,res)=>res.json(list(req.user.id).filter(p=>!p.parent_id).map(p=>serializeProject(db,p,req.user.id))));
  router.get('/projects/tree',(req,res)=>{
    const items=list(req.user.id).map(p=>({...serializeProject(db,p,req.user.id),children:[]}));
    const index=new Map(items.map(p=>[p.id,p])), roots=[];
    for(const p of items) { if(p.parentId && index.has(p.parentId)) index.get(p.parentId).children.push(p); else roots.push(p); }
    res.json(roots);
  });
  router.post('/projects',(req,res)=>{
    const name=text(req.body.name,'نام پروژه');
    const parentId=req.body.parentId==null ? null : text(req.body.parentId,'پروژه والد',100);
    const parent=parentId ? accessProject(db,parentId,req.user.id) : null;
    if (parent && serializeProject(db,parent,req.user.id).pathNames.length>=12) fail(400,'عمق زیرپروژه‌ها نباید بیشتر از ۱۲ باشد.');
    const projectId=id();
    db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run(projectId,name,parentId,parent?.root_id || projectId,parent?.owner_id || req.user.id,now());
    res.status(201).json(serializeProject(db,db.prepare('SELECT * FROM projects WHERE id=?').get(projectId),req.user.id));
  });
  router.get('/projects/:id',(req,res)=>res.json(serializeProject(db,accessProject(db,req.params.id,req.user.id),req.user.id)));
  router.patch('/projects/:id',(req,res)=>{
    const p=accessProject(db,req.params.id,req.user.id,true);
    db.prepare('UPDATE projects SET name=? WHERE id=?').run(text(req.body.name,'نام پروژه'),p.id);
    res.json(serializeProject(db,db.prepare('SELECT * FROM projects WHERE id=?').get(p.id),req.user.id));
  });
  router.delete('/projects/:id',(req,res)=>{
    const p=accessProject(db,req.params.id,req.user.id,true);
    // Non-empty projects must be emptied explicitly to prevent accidental subtree loss.
    if (db.prepare('SELECT 1 FROM projects WHERE parent_id=?').get(p.id) ||
        db.prepare('SELECT 1 FROM works WHERE project_id=?').get(p.id)) fail(409,'ابتدا کارها و زیرپروژه‌های این پروژه را حذف کنید.');
    db.prepare('DELETE FROM projects WHERE id=?').run(p.id);
    res.status(204).end();
  });
  router.get('/projects/:id/members',(req,res)=>{
    const p=accessProject(db,req.params.id,req.user.id);
    res.json({ ownerId:p.owner_id,rootId:p.root_id,canManage:p.owner_id===req.user.id,members:projectMembers(db,p) });
  });
  router.post('/projects/:id/members',(req,res)=>{
    const p=accessProject(db,req.params.id,req.user.id,true);
    const identifier=text(req.body.identifier,'نام کاربری یا ایمیل',254).toLowerCase();
    const user=db.prepare('SELECT * FROM users WHERE username=? OR email=?').get(identifier,identifier);
    if(!user) fail(404,'کاربر ثبت‌شده‌ای با این مشخصات پیدا نشد.');
    if(user.id!==p.owner_id) db.prepare('INSERT OR IGNORE INTO project_members VALUES(?,?)').run(p.root_id,user.id);
    res.status(201).json({ ownerId:p.owner_id,rootId:p.root_id,canManage:true,members:projectMembers(db,p) });
  });
  router.delete('/projects/:id/members/:userId',(req,res)=>{
    const p=accessProject(db,req.params.id,req.user.id,true);
    if(req.params.userId===p.owner_id) fail(400,'مالک پروژه قابل حذف نیست.');
    transaction(db,()=>{
      db.prepare(`DELETE FROM work_assignees WHERE user_id=? AND work_id IN
        (SELECT w.id FROM works w JOIN projects p ON p.id=w.project_id WHERE p.root_id=?)`).run(req.params.userId,p.root_id);
      db.prepare('DELETE FROM project_members WHERE project_id=? AND user_id=?').run(p.root_id,req.params.userId);
    });
    res.status(204).end();
  });
  return router;
}
