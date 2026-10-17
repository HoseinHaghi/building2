import axios from 'axios';
let csrfToken=null;
export const setCsrfToken=value=>{csrfToken=value;};
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL || '/api',timeout:20000,withCredentials:true});
api.interceptors.request.use(config=>{
  if(csrfToken && !['get','head','options'].includes(config.method)) config.headers['X-CSRF-Token']=csrfToken;
  return config;
});
api.interceptors.response.use(response=>response,error=>{
  if(error.response?.status===401 && !/\/auth\/(login|register|me)$/.test(error.config?.url || ''))
    window.dispatchEvent(new Event('building:unauthorized'));
  return Promise.reject(error);
});
export const errorMessage=error=>error?.response?.data?.error || 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.';
export const fileUrl=file=>file ? `${api.defaults.baseURL.replace(/\/$/,'')}/files/${encodeURIComponent(file.id)}` : '';
export default api;
