import { createContext,useContext,useEffect,useState,useCallback,useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api,{setCsrfToken} from '../lib/api';
import { clearAllWorkDraftFiles,clearWorkDraftMemory } from '../lib/workDraftFiles';
import {clearUserSubmissions} from '../lib/submissions';
const AuthContext=createContext(null);
export function AuthProvider({children}) {
  const [user,setUser]=useState(null),[loading,setLoading]=useState(true);
  const [explicitLogout,setExplicitLogout]=useState(false);
  const [sessionError,setSessionError]=useState(null),generation=useRef(0);
  const cache=useQueryClient();
  const invalidateSessionRequest=useCallback(()=>{generation.current++;},[]);
  const retrySession=useCallback(async()=>{
    const current=++generation.current;
    setLoading(true);setSessionError(null);
    try {
      const {data}=await api.get('/auth/me');
      if(current===generation.current){setUser(data.user);setCsrfToken(data.csrfToken);}
    } catch(error) {
      if(current!==generation.current)return;
      if(error.response?.status===401){setUser(null);setCsrfToken(null);cache.clear();}
      else setSessionError(error);
    } finally {if(current===generation.current)setLoading(false);}
  },[cache]);
  useEffect(()=>{
    const reset=()=>{generation.current++;clearWorkDraftMemory();setUser(null);setCsrfToken(null);setSessionError(null);setLoading(false);cache.clear();};
    window.addEventListener('building:unauthorized',reset);
    retrySession();
    return()=>{invalidateSessionRequest();window.removeEventListener('building:unauthorized',reset);};
  },[cache,retrySession,invalidateSessionRequest]);
  const accept=data=>{generation.current++;cache.clear();setSessionError(null);setLoading(false);setExplicitLogout(false);setCsrfToken(data.csrfToken);setUser(data.user);return data.user;};
  return <AuthContext.Provider value={{user,loading,explicitLogout,sessionError,retrySession,
    login:async values=>accept((await api.post('/auth/login',values)).data),
    register:async values=>accept((await api.post('/auth/register',values)).data),
    logout:async()=>{
      await api.post('/auth/logout');
      generation.current++;clearUserSubmissions(user.id);
      await clearAllWorkDraftFiles(user.id).catch(()=>{});
      try {
        for(const key of Object.keys(sessionStorage)) {
          if(/^(createWorkDraft:|editWorkDraft:|createProjectDraft:|reportDraft:|reportDialog:)/.test(key) && key.endsWith(':'+user.id))sessionStorage.removeItem(key);
        }
      } catch { /* Storage may be unavailable. */ }
      setExplicitLogout(true);setUser(null);setCsrfToken(null);cache.clear();
    },
    updateUser:setUser,accept}}>
    {children}
  </AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
