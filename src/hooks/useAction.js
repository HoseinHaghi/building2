import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../lib/api';
export function useAction() {
  const cache=useQueryClient(),[pending,setPending]=useState(false),[error,setError]=useState('');
  const run=async(action)=>{
    setPending(true);setError('');
    try {
      const result=await action();
      await Promise.all(['works','projects','reports','members'].map(key=>cache.invalidateQueries({queryKey:[key]})));
      return result ?? true;
    } catch(cause) {setError(errorMessage(cause));return null;}
    finally {setPending(false);}
  };
  return {pending,error,run,clearError:()=>setError('')};
}
