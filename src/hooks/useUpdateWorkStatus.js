import {useMutation,useQueryClient} from '@tanstack/react-query';
import api from '../lib/api';
export function useUpdateWorkStatus(){
 const cache=useQueryClient();
 return useMutation({mutationFn:async({id,status})=>(await api.patch('/works/'+encodeURIComponent(id)+'/status',{status})).data,
 onSuccess:()=>cache.invalidateQueries({queryKey:['works']})});
}
