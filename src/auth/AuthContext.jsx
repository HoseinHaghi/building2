import { createContext,useContext,useEffect,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api,{setCsrfToken} from '../lib/api';
import { clearAllWorkDraftFiles } from '../lib/workDraftFiles';
const AuthContext=createContext(null);
export function AuthProvider({children}) {
  const [user,setUser]=useState(null),[loading,setLoading]=useState(true);
  const [explicitLogout,setExplicitLogout]=useState(false);
  const cache=useQueryClient();
  useEffect(()=>{
    let mounted=true;
    const reset=()=>{clearAllWorkDraftFiles();setUser(null);setCsrfToken(null);cache.clear();};
    window.addEventListener('building:unauthorized',reset);
    api.get('/auth/me').then(({data})=>{if(mounted){setUser(data.user);setCsrfToken(data.csrfToken);}})
      .catch(()=>{}).finally(()=>{if(mounted)setLoading(false);});
    return()=>{mounted=false;window.removeEventListener('building:unauthorized',reset);};
  },[cache]);
  const accept=data=>{cache.clear();setExplicitLogout(false);setCsrfToken(data.csrfToken);setUser(data.user);return data.user;};
  return <AuthContext.Provider value={{user,loading,explicitLogout,
    login:async values=>accept((await api.post('/auth/login',values)).data),
    register:async values=>accept((await api.post('/auth/register',values)).data),
    logout:async()=>{
      await api.post('/auth/logout');
      clearAllWorkDraftFiles();
      try {
        for(const key of Object.keys(sessionStorage)) {
          if(/^(createWorkDraft:|editWorkDraft:|createProjectDraft:)/.test(key) && key.endsWith(':'+user.id))sessionStorage.removeItem(key);
        }
      } catch { /* Storage may be unavailable. */ }
      setExplicitLogout(true);setUser(null);setCsrfToken(null);cache.clear();
    },
    updateUser:setUser,accept}}>
    {children}
  </AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
