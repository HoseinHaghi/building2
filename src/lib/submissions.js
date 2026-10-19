import api from './api';
const pending=new Map();
const prefix='pendingRequest:';
export async function postOnce(scope,url,body) {
  const key=prefix+scope;
  let record=pending.get(key);
  try {record=JSON.parse(sessionStorage.getItem(key)) || record;} catch { /* Keep the retry key in memory if storage is unavailable. */ }
  // Keep one key for the whole draft, including edits after an uncertain response.
  // The server rejects changed payloads if this draft was already committed.
  if(!record?.key)record={key:crypto.randomUUID()};
  pending.set(key,record);
  try {sessionStorage.setItem(key,JSON.stringify(record));} catch { /* The same tab can still retry safely. */ }
  return api.post(url,body,{headers:{'Idempotency-Key':record.key}});
}
export function clearSubmission(scope) {
  const key=prefix+scope;pending.delete(key);
  try {sessionStorage.removeItem(key);} catch { /* Storage may be unavailable. */ }
}
export function clearUserSubmissions(userId) {
  for(const key of pending.keys())if(key.endsWith(':'+userId))pending.delete(key);
  try {for(const key of Object.keys(sessionStorage))if(key.startsWith(prefix) && key.endsWith(':'+userId))sessionStorage.removeItem(key);} catch { /* Storage may be unavailable. */ }
}
export const versionHeaders=version=>({'If-Match':`"${version || ''}"`});
export const isVersionConflict=error=>[412,428].includes(error?.response?.status);
