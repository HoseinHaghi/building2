import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const parameters = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('hex');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, parameters);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [, salt, hex] = stored.split('$');
  const key = await derive(password, salt, 64, parameters);
  const expected = Buffer.from(hex, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key);
}
export function safeEqual(a,b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left=Buffer.from(a), right=Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left,right);
}
export function cookieToken(req) {
  const name = req.app.locals.config.secureCookies ? '__Host-building_session' : 'building_session';
  const part = (req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(`${name}=`));
  const value=part?.slice(name.length+1);
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
}
export function publicUser(user) {
  return { id:user.id,name:user.name,username:user.username,email:user.email };
}
