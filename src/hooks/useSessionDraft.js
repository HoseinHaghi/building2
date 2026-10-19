import { useCallback, useRef, useState } from 'react';
import {clearSubmission} from '../lib/submissions';

export function readSessionDraft(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

export function removeSessionDraft(key) {
  clearSubmission(key);
  try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}

export function useSessionDraft(key, defaults, fresh = false) {
  const [draft, setDraft] = useState(() => {
    const initial = { ...defaults, ...(fresh ? {} : readSessionDraft(key)) };
    if (fresh) {
      clearSubmission(key);
      try { sessionStorage.setItem(key, JSON.stringify(initial)); } catch { /* Keep editing in memory. */ }
    }
    return initial;
  });
  const current = useRef(draft);
  const update = useCallback(patch => {
    const next = { ...current.current, ...patch };
    current.current = next;
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep editing in memory. */ }
    setDraft(next);
  }, [key]);
  const clear = useCallback(() => removeSessionDraft(key), [key]);
  return [draft, update, clear];
}
