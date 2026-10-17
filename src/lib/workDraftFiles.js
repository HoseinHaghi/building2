// Files stay in this tab's memory while the project picker changes routes.
const drafts = new Map();
export const readWorkDraftFiles = key => drafts.get(key) || {};
export function setWorkDraftFile(key, kind, file) {
  drafts.set(key, { ...readWorkDraftFiles(key), [kind]: file });
}
export const clearWorkDraftFiles = key => drafts.delete(key);
export const clearAllWorkDraftFiles = () => drafts.clear();
