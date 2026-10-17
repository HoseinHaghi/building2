import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
export function useProjects() {
  return useQuery({queryKey:['projects','list'],queryFn:async()=>(await api.get('/projects')).data});
}
