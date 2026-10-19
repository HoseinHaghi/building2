import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../lib/api';
import {isVersionConflict} from '../lib/submissions';
export function useAction() {
  const cache=useQueryClient(),[pending,setPending]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false);
  const run=async(action)=>{
    setPending(true);setError('');setConflict(false);
    try {
      const result=await action();
      await Promise.all(['works','projects','reports','members'].map(key=>cache.invalidateQueries({queryKey:[key]})));
      return result ?? true;
    } catch(cause) {setError(errorMessage(cause));setConflict(isVersionConflict(cause));return null;}
    finally {setPending(false);}
  };
  return {pending,error,conflict,run,clearError:()=>{setError('');setConflict(false);}};
}
