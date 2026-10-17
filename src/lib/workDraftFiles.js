const drafts = new Map();
const writes = new Map();
let database;
let fallbackTab;

function tabId() {
  try {
    let id = sessionStorage.getItem('buildingDraftTab');
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('buildingDraftTab', id); }
    return id;
  } catch { return fallbackTab ||= crypto.randomUUID(); }
}
const storageKey = key => tabId() + ':' + key;

function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('building-work-drafts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Draft storage is unavailable'));
  }).catch(error => { database = null; throw error; });
  return database;
}

async function transact(mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', mode);
    const request = operation(transaction.objectStore('files'));
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Draft storage was interrupted'));
  });
}

function enqueue(key, operation) {
  const next = (writes.get(key) || Promise.resolve()).catch(() => {}).then(operation);
  writes.set(key, next);
  next.finally(() => { if (writes.get(key) === next) writes.delete(key); }).catch(() => {});
  return next;
}

export const readWorkDraftFiles = key => drafts.get(storageKey(key)) || {};

export async function restoreWorkDraftFiles(key) {
  const id = storageKey(key);
  await writes.get(id)?.catch(() => {});
  if (drafts.has(id)) return drafts.get(id);
  const record = await transact('readonly', store => store.get(id));
  const files = record?.files || {};
  drafts.set(id, files);
  return files;
}

export function setWorkDraftFile(key, kind, file) {
  const id = storageKey(key);
  const files = { ...readWorkDraftFiles(key), [kind]: file };
  drafts.set(id, files);
  return enqueue(id, () => transact('readwrite', store => store.put({
    key: id, tab: tabId(), owner: key.slice(key.lastIndexOf(':') + 1), files,
  })));
}

export function clearWorkDraftFiles(key) {
  const id = storageKey(key);
  drafts.delete(id);
  return enqueue(id, () => transact('readwrite', store => store.delete(id)));
}

export const clearWorkDraftMemory = () => drafts.clear();

export async function clearAllWorkDraftFiles(owner) {
  drafts.clear();
  await Promise.allSettled([...writes.values()]);
  const tab = tabId();
  await transact('readwrite', store => {
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const current = cursor.result;
      if (!current) return;
      if (current.value.tab === tab && (!owner || current.value.owner === owner)) current.delete();
      current.continue();
    };
  });
}

export async function validateWorkFile(file, kind) {
  if (!file) return;
  if (!file.size) throw new Error('فایل خالی قابل انتخاب نیست.');
  if (file.size > 10 * 1024 * 1024) throw new Error('حجم هر فایل باید حداکثر ۱۰ مگابایت باشد.');
  if (kind !== 'cover') return;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = [137,80,78,71,13,10,26,10].every((byte,index) => bytes[index] === byte);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  if (!png && !jpeg && !webp) throw new Error('تصویر شاخص باید PNG، JPEG یا WebP باشد.');
}
