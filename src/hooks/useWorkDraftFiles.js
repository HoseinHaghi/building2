import { useEffect, useRef, useState } from 'react';
import { readWorkDraftFiles,restoreWorkDraftFiles,setWorkDraftFile,clearWorkDraftFiles,validateWorkFile } from '../lib/workDraftFiles';

export function useWorkDraftFiles(key, fresh) {
  const freshEntry = useRef(fresh);
  const [files,setFiles] = useState(() => fresh ? {} : readWorkDraftFiles(key));
  const [loading,setLoading] = useState(true),[saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        if (freshEntry.current) await clearWorkDraftFiles(key);
        const restored = await restoreWorkDraftFiles(key);
        if (mounted) setFiles(restored);
      } catch {
        if (mounted) setError('بازیابی فایل‌های موقت انجام نشد. فایل‌ها را دوباره انتخاب کنید.');
      } finally { if (mounted) setLoading(false); }
    };
    restore();
    return () => { mounted = false; };
  },[key]);
  const select = async (kind,file) => {
    setError('');setSaving(true);
    try {
      await validateWorkFile(file,kind);
      try { await setWorkDraftFile(key,kind,file); }
      catch {
        setError('ذخیره موقت فایل در مرورگر انجام نشد. فایل در این صفحه قابل ارسال است؛ پیش از ارسال صفحه را رفرش نکنید.');
      }
      setFiles(readWorkDraftFiles(key));
    } catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  };
  const clear = async () => {
    try { await clearWorkDraftFiles(key);setFiles({});setError('');return true; }
    catch { setError('پاک‌کردن فایل موقت انجام نشد. دوباره تلاش کنید.');return false; }
  };
  return {files,loading,saving,error,select,clear};
}
