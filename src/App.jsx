import { Component,lazy,Suspense } from 'react';
import { Routes,Route,Navigate,Outlet,Link,useLocation } from 'react-router-dom';
import { Alert,Box,Button,Typography,Paper } from '@mui/material';
import { useAuth } from './auth/AuthContext';
import { Loading } from './components/shared';
const LoginPage=lazy(()=>import('./components/LoginPage'));
const Dashboard=lazy(()=>import('./components/UserProfile'));
const CreateProjectPage=lazy(()=>import('./components/CreateProjectPage'));
const SelectProjectPage=lazy(()=>import('./components/SelectProjectPage'));
const WorkCreationPage=lazy(()=>import('./components/WorkCreationPage'));
const WorkPage=lazy(()=>import('./components/WorkPage'));
function ProtectedLayout() {
  const {user,loading,explicitLogout}=useAuth(),location=useLocation();
  if(loading)return <Loading/>;
  if(!user)return <Navigate to="/login" state={{from:explicitLogout ? '/dashboard' : location.pathname+location.search}} replace/>;
  return <Outlet/>;
}
class ErrorBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed ? <Box sx={{p:4}}><Alert severity="error">نمایش صفحه با خطا روبه‌رو شد.</Alert><Button onClick={()=>window.location.reload()}>بارگذاری دوباره</Button></Box> : this.props.children;}
}
export default function App() {
  const auth=useAuth();
  if(auth.loading)return <Loading/>;
  if(auth.sessionError)return <Box sx={{minHeight:'100dvh',display:'grid',placeItems:'center',p:2,boxSizing:'border-box'}} dir="rtl">
    <Paper sx={{p:3,borderRadius:3,width:360,maxWidth:'100%',boxSizing:'border-box',fontFamily:'IRANYekanWeb',textAlign:'center'}}>
      <Typography component="h1" sx={{fontFamily:'inherit',fontSize:21,mb:2}}>ارتباط با سرور برقرار نشد</Typography>
      <Alert severity="warning" sx={{fontFamily:'inherit',borderRadius:2,mb:2}}>وضعیت ورود شما هنوز بررسی نشده است. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.</Alert>
      <Button variant="contained" onClick={auth.retrySession} sx={{bgcolor:'#ff7043',fontFamily:'inherit',borderRadius:2,'&:hover':{bgcolor:'#e65c35'}}}>تلاش دوباره</Button>
    </Paper>
  </Box>;
  return <ErrorBoundary><Suspense fallback={<Loading/>}><Routes>
    <Route path="/login" element={<LoginPage/>}/>
    <Route element={<ProtectedLayout/>}>
      <Route index element={<Navigate to="/dashboard" replace/>}/>
      <Route path="/dashboard" element={<Dashboard/>}/>
      <Route path="/create-project" element={<CreateProjectPage/>}/>
      <Route path="/select-project" element={<SelectProjectPage/>}/>
      <Route path="/create-work" element={<WorkCreationPage/>}/>
      <Route path="/works/:id/edit" element={<WorkCreationPage/>}/>
      <Route path="/works/:id" element={<WorkPage/>}/>
      <Route path="*" element={<Box><Typography variant="h5">صفحه یافت نشد.</Typography><Button component={Link} to="/dashboard">بازگشت به داشبورد</Button></Box>}/>
    </Route>
  </Routes></Suspense></ErrorBoundary>;
}
