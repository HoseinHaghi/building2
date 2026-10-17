import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
export function useProjectTree() {
  return useQuery({queryKey:['projects','tree'],queryFn:async()=>(await api.get('/projects/tree')).data});
}
