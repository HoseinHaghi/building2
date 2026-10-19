import {createHash} from 'node:crypto';
export const versionOf=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function workVersion(db,id) {
  return versionOf([db.prepare('SELECT * FROM works WHERE id=?').get(id),
    db.prepare('SELECT user_id FROM work_assignees WHERE work_id=? ORDER BY user_id').all(id),
    db.prepare('SELECT * FROM files WHERE work_id=? ORDER BY id').all(id)]);
}
export const reportVersion=report=>versionOf([report.id,report.work_id,report.author_id,report.text,report.created_at,report.updated_at]);
export const nextTimestamp=previous=>new Date(Math.max(Date.now(),Date.parse(previous)+1)).toISOString();
