import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
export function useWorks(filters={}) {
  return useQuery({queryKey:['works','list',filters],queryFn:async()=>(await api.get('/works',{params:filters})).data});
}
export function useWork(id) {
  return useQuery({queryKey:['works','detail',id],queryFn:async()=>(await api.get(`/works/${encodeURIComponent(id)}`)).data,enabled:!!id});
}
export function useReports(id) {
  return useQuery({queryKey:['reports',id],queryFn:async()=>(await api.get(`/works/${encodeURIComponent(id)}/reports`)).data,enabled:!!id});
}
export function useMembers(projectId) {
  return useQuery({queryKey:['members',projectId],queryFn:async()=>(await api.get(`/projects/${encodeURIComponent(projectId)}/members`)).data,enabled:!!projectId});
}
