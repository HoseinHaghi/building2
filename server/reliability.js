import {createHash} from 'node:crypto';
import {fail,now} from './domain.js';
import {versionOf} from './versions.js';
export {workVersion,reportVersion,nextTimestamp} from './versions.js';
export function requireVersion(req,current) {
  const expected=req.get('If-Match');
  if(!expected)fail(428,'ابتدا آخرین نسخه اطلاعات را دریافت کنید و دوباره ذخیره کنید.');
  if(expected!==`"${current}"`)fail(412,'این اطلاعات توسط فرد دیگری تغییر کرده است. نسخه جدید را بررسی کنید؛ تغییرات شما هنوز ذخیره نشده‌اند.');
}
function canonical(value) {
  if(Array.isArray(value))return value.map(canonical);
  if(value && typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
// Call inside the same transaction as the insert, after checking current access.
export function requestKey(db,req,type) {
  const key=req.get('Idempotency-Key');
  if(!key)return null;
  if(!/^[A-Za-z0-9_-]{16,128}$/.test(key))fail(400,'شناسه درخواست معتبر نیست.');
  const files=Object.entries(req.files || {}).sort(([a],[b])=>a.localeCompare(b)).map(([kind,items])=>[kind,items.map(file=>[
    file.originalname,file.mimetype,file.size,createHash('sha256').update(file.buffer).digest('hex'),
  ])]);
  const fingerprint=versionOf([req.method,req.path,canonical(req.body),files]);
  const previous=db.prepare('SELECT * FROM request_keys WHERE user_id=? AND request_key=?').get(req.user.id,key);
  if(previous && (previous.fingerprint!==fingerprint || previous.resource_type!==type))
    fail(409,'این درخواست قبلاً با اطلاعات دیگری ثبت شده است. اطلاعات فرم را بررسی کنید.');
  return {key,fingerprint,resourceId:previous?.resource_id};
}
export function rememberRequest(db,req,record,type,id) {
  if(record)db.prepare('INSERT INTO request_keys VALUES(?,?,?,?,?,?)').run(req.user.id,record.key,record.fingerprint,type,id,now());
}
