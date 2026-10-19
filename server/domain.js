import { randomUUID } from 'node:crypto';
import {workVersion,reportVersion} from './versions.js';
export class HttpError extends Error {
  constructor(status,message) { super(message); this.status=status; }
}
export const fail = (status,message) => { throw new HttpError(status,message); };
export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export function text(value,label,max=200,required=true) {
  if (typeof value !== 'string') {
    if (!required && value == null) return '';
    fail(400,`${label} معتبر نیست.`);
  }
  const result=value.trim();
  if ((required && !result) || result.length > max || result.includes(String.fromCharCode(0))) fail(400,`${label} معتبر نیست (حداکثر ${max} نویسه).`);
  return result;
}
export function accessProject(db,projectId,userId,ownerOnly=false) {
  const project=db.prepare(`SELECT p.* FROM projects p WHERE p.id=? AND (p.owner_id=? OR EXISTS
    (SELECT 1 FROM project_members m WHERE m.project_id=p.root_id AND m.user_id=?))`).get(projectId,userId,userId);
  if (!project) fail(404,'پروژه یافت نشد.');
  if (ownerOnly && project.owner_id !== userId) fail(403,'این عملیات فقط برای مالک پروژه مجاز است.');
  return project;
}
export function projectMembers(db,project) {
  return db.prepare(`SELECT id,name,username FROM users WHERE id=? OR id IN
    (SELECT user_id FROM project_members WHERE project_id=?) ORDER BY name`).all(project.owner_id,project.root_id);
}
export function projectPath(db,project) {
  const parts=[project.name]; let current=project;
  while (current.parent_id) {
    current=db.prepare('SELECT * FROM projects WHERE id=?').get(current.parent_id);
    if (!current) break; parts.unshift(current.name);
  }
  return parts;
}
export function serializeProject(db,p,userId) {
  const pathNames=projectPath(db,p);
  return { id:p.id,name:p.name,label:p.name,parentId:p.parent_id,rootId:p.root_id,ownerId:p.owner_id,
    canManage:p.owner_id===userId,pathNames,displayPath:pathNames.join(' > '),createdAt:p.created_at };
}
export function accessWork(db,workId,userId,edit=false) {
  const work=db.prepare('SELECT * FROM works WHERE id=?').get(workId);
  if (!work) fail(404,'کار یافت نشد.');
  const project=accessProject(db,work.project_id,userId);
  const assigned=db.prepare('SELECT 1 FROM work_assignees WHERE work_id=? AND user_id=?').get(work.id,userId);
  work.can_edit=work.creator_id===userId || project.owner_id===userId;
  work.can_change_status=work.can_edit || Boolean(assigned);
  if (edit && !work.can_edit) fail(403,'ویرایش این کار برای شما مجاز نیست.');
  return { work,project };
}
export function serializeWork(db,w,userId) {
  const project=db.prepare('SELECT * FROM projects WHERE id=?').get(w.project_id);
  const creator=db.prepare('SELECT id,name,username FROM users WHERE id=?').get(w.creator_id);
  const assignees=db.prepare(`SELECT u.id,u.name,u.username FROM users u JOIN work_assignees a ON a.user_id=u.id
    WHERE a.work_id=? ORDER BY u.name`).all(w.id);
  const files=db.prepare('SELECT * FROM files WHERE work_id=?').all(w.id);
  const fileData=kind=>{ const f=files.find(f=>f.kind===kind); return f ? { id:f.id,name:f.original_name,size:f.size,url:`/api/files/${f.id}` } : null; };
  const canEdit=w.creator_id===userId || project.owner_id===userId;
  return { id:w.id,version:workVersion(db,w.id),title:w.title,projectId:w.project_id,project:projectPath(db,project).join(' > '),
    floorNum:w.floor_num,floor:`طبقه ${w.floor_num}`,summary:w.summary,prerequisite:w.prerequisite,status:w.status,
    creator,assignees,cover:fileData('cover'),attachment:fileData('attachment'),canEdit,
    canChangeStatus:canEdit || assignees.some(a=>a.id===userId),createdAt:w.created_at,updatedAt:w.updated_at };
}
export function serializeReport(db,r,userId,ownerId) {
  const author=db.prepare('SELECT id,name,username FROM users WHERE id=?').get(r.author_id);
  return { id:r.id,version:reportVersion(r),text:r.text,author,createdAt:r.created_at,updatedAt:r.updated_at,canEdit:r.author_id===userId || ownerId===userId };
}
