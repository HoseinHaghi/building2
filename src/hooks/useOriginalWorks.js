import { useQuery,useMutation,useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {postOnce,versionHeaders} from '../lib/submissions';
export function useOriginalWorks(filters={},enabled=true) {
  return useQuery({
    queryKey:['works','original',filters],enabled,
    queryFn:async({signal})=>{
      const items=[];let page=1,total=0;
      do {
        const {data}=await api.get('/works',{params:{...filters,page,limit:100},signal});
        items.push(...data.items);total=data.total;page+=1;
        if(data.items.length===0)break;
      }while(items.length<total);
      return items;
    },
  });
}
export function useSaveWork(id) {
  const cache=useQueryClient();
  return useMutation({mutationFn:async({form,version,scope})=>(await (id ? api.patch('/works/'+encodeURIComponent(id),form,{headers:versionHeaders(version)}) : postOnce(scope,'/works',form))).data,
    onSuccess:()=>cache.invalidateQueries({queryKey:['works']})});
}
