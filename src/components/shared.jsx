import { useState } from 'react';
import { Alert,Box,Button,CircularProgress,Dialog,DialogActions,DialogContent,DialogTitle,Stack,TextField,Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '../lib/api';
import { useSessionDraft } from '../hooks/useSessionDraft';
export const floors=['تولید محتوا','کارآموز','توسعه‌دهنده','خلاقیت','مسئله علمی','مدیریت','طرح مسئله'];
export const dateLabel=value=>new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export function Loading() {return <Box sx={{display:'flex',justifyContent:'center',p:6}} role="status" aria-label="در حال بارگذاری"><CircularProgress/></Box>;}
export function QueryFeedback({query,label}) {
  if(query.isPending)return <Loading/>;
  if(query.isError)return <Alert dir="rtl" severity="error"
    sx={{fontFamily:'IRANYekanWeb',borderRadius:2,gap:1,
      '& .MuiAlert-message':{flex:1,minWidth:0},
      '& .MuiAlert-icon':{margin:0},
      '& .MuiAlert-action':{margin:0,padding:0,alignSelf:'center',flexShrink:0},
      '& .MuiButton-root':{fontFamily:'inherit',color:'#e65c35'}}}
    action={<Button size="small" color="inherit" disabled={query.isFetching} onClick={()=>query.refetch()}>تلاش دوباره</Button>}>
    {label && <Box>{label}</Box>}{errorMessage(query.error)}</Alert>;
  return null;
}
export function ActionError({action}) {return action.error ? <Alert severity="error" sx={{my:2}}>{action.error}</Alert> : null;}
export function PageTitle({title,description,actions}) {
  return <Stack direction={{xs:'column',sm:'row'}} justifyContent="space-between" alignItems={{xs:'stretch',sm:'center'}} gap={2} sx={{mb:3}}>
    <Box><Typography variant="h5" component="h1">{title}</Typography>{description && <Typography color="text.secondary" sx={{mt:1}}>{description}</Typography>}</Box>{actions}
  </Stack>;
}
const dialogPaper = {dir:'rtl',sx:{borderRadius:3,fontFamily:'IRANYekanWeb',p:1,
  '& .MuiTypography-root,& .MuiInputBase-root,& .MuiFormLabel-root,& .MuiAlert-root':{fontFamily:'inherit'},
  '& .MuiDialogTitle-root':{textAlign:'center',fontSize:22,fontWeight:500},
  '& .MuiButton-root':{fontFamily:'inherit',borderRadius:2},
  '& .MuiButton-contained':{bgcolor:'#ff7043','&:hover':{bgcolor:'#e65c35'}},
  '& .MuiButton-text':{color:'#757575'}}};
export function ConfirmDialog({open,title,description,onClose,onConfirm,pending,error,confirmLabel='حذف'}) {
  return <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="xs" PaperProps={dialogPaper}>
    <DialogTitle>{title}</DialogTitle><DialogContent><Typography>{description}</Typography>{error && <Alert severity="error" sx={{mt:2}}>{error}</Alert>}</DialogContent>
    <DialogActions disableSpacing sx={{gap:1}}><Button onClick={onClose} disabled={pending}>انصراف</Button><Button variant="contained" onClick={onConfirm} disabled={pending}>{confirmLabel}</Button></DialogActions>
  </Dialog>;
}
export function TextDialog({open,title,initial='',onClose,onCancel=onClose,onSave,pending,error,label='نام',multiline=false,value:controlledValue,onChange}) {
  const [localValue,setValue]=useState(initial);
  const value=controlledValue ?? localValue;
  // This component is mounted with a key whenever a new edit starts.
  return <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="xs" PaperProps={dialogPaper}>
    <Box component="form" onSubmit={e=>{e.preventDefault();if(!pending && value.trim())onSave(value.trim());}}>
      <DialogTitle>{title}</DialogTitle><DialogContent><TextField autoFocus fullWidth required disabled={pending} label={label} value={value} multiline={multiline} minRows={multiline ? 4 : undefined} onChange={e=>onChange ? onChange(e.target.value) : setValue(e.target.value)}
        InputLabelProps={{shrink:true}} inputProps={{dir:'rtl','aria-label':label}}
        sx={{mt:1,
          '& .MuiOutlinedInput-root':{borderRadius:3,bgcolor:'#f5f5f5','& fieldset,&:hover fieldset,&.Mui-focused fieldset':{border:0},'&.Mui-focused':{boxShadow:'0 0 0 1px #ff7043'}},
          '& .MuiInputLabel-root':{right:20,left:'auto',transformOrigin:'top right','&.MuiInputLabel-shrink':{transform:'translate(0,-9px) scale(0.75)'}},
          '& label.Mui-focused':{color:'#ff7043'}}}/>
        {error && <Alert severity="error" sx={{mt:2}}>{error}</Alert>}</DialogContent>
      <DialogActions disableSpacing sx={{gap:1}}><Button onClick={onCancel} disabled={pending}>انصراف</Button><Button type="submit" variant="contained" disabled={pending || !value.trim()}>ذخیره</Button></DialogActions>
    </Box>
  </Dialog>;
}
export function DraftTextDialog({draftKey,initial='',onSave,onClose,...props}) {
  const [draft,update,clear]=useSessionDraft(draftKey,{text:initial});
  return <TextDialog {...props} initial={initial} value={draft.text} onChange={text=>update({text})}
    onClose={onClose} onCancel={()=>{clear();onClose();}}
    onSave={async value=>{if(await onSave(value))clear();}}/>;
}
export function RetryAll() {
  const cache=useQueryClient();
  return <Button onClick={()=>cache.invalidateQueries()}>تازه‌سازی</Button>;
}
