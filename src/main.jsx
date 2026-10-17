import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import App from './App';
import './index.css';
const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:15000,retry:(count,error)=>error?.response?.status>=500 && count<1}}});
ReactDOM.createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><QueryClientProvider client={queryClient}>
  <AuthProvider><App/></AuthProvider>
</QueryClientProvider></BrowserRouter></StrictMode>);
