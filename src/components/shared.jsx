import { useState } from 'react';
import { Alert,Box,Button,CircularProgress,Dialog,DialogActions,DialogContent,DialogTitle,Stack,TextField,Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../lib/api';
export const floors=['تولید محتوا','کارآموز','توسعه‌دهنده','خلاقیت','مسئله علمی','مدیریت','طرح مسئله'];
export const dateLabel=value=>new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export function Loading() {return <Box sx={{display:'flex',justifyContent:'center',p:6}} role="status" aria-label="در حال بارگذاری"><CircularProgress/></Box>;}
export function QueryFeedback({query}) {
  if(query.isPending)return <Loading/>;
  if(query.isError)return <Alert severity="error" action={<Button color="inherit" onClick={()=>query.refetch()}>تلاش دوباره</Button>}>{errorMessage(query.error)}</Alert>;
  return null;
}
export function ActionError({action}) {return action.error ? <Alert severity="error" sx={{my:2}}>{action.error}</Alert> : null;}
export function PageTitle({title,description,actions}) {
  return <Stack direction={{xs:'column',sm:'row'}} justifyContent="space-between" alignItems={{xs:'stretch',sm:'center'}} gap={2} sx={{mb:3}}>
    <Box><Typography variant="h5" component="h1">{title}</Typography>{description && <Typography color="text.secondary" sx={{mt:1}}>{description}</Typography>}</Box>{actions}
  </Stack>;
}
export function ConfirmDialog({open,title,description,onClose,onConfirm,pending,error}) {
  return <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="xs">
    <DialogTitle>{title}</DialogTitle><DialogContent><Typography>{description}</Typography>{error && <Alert severity="error" sx={{mt:2}}>{error}</Alert>}</DialogContent>
    <DialogActions><Button onClick={onClose} disabled={pending}>انصراف</Button><Button color="error" variant="contained" onClick={onConfirm} disabled={pending}>حذف</Button></DialogActions>
  </Dialog>;
}
export function TextDialog({open,title,initial='',onClose,onSave,pending,error,label='نام'}) {
  const [value,setValue]=useState(initial);
  // This component is mounted with a key whenever a new edit starts.
  return <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="sm">
    <Box component="form" onSubmit={e=>{e.preventDefault();onSave(value);}}>
      <DialogTitle>{title}</DialogTitle><DialogContent><TextField autoFocus fullWidth required label={label} value={value} multiline minRows={2} onChange={e=>setValue(e.target.value)} sx={{mt:1}}/>
        {error && <Alert severity="error" sx={{mt:2}}>{error}</Alert>}</DialogContent>
      <DialogActions><Button onClick={onClose} disabled={pending}>انصراف</Button><Button type="submit" variant="contained" disabled={pending || !value.trim()}>ذخیره</Button></DialogActions>
    </Box>
  </Dialog>;
}
export function RetryAll() {
  const cache=useQueryClient();
  return <Button onClick={()=>cache.invalidateQueries()}>تازه‌سازی</Button>;
}
