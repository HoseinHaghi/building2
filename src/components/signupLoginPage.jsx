import * as React from 'react';
import TabsCustom from './Tab.jsx';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { Typography } from '@mui/material';

export default function LoginPage() {
  return (
    <Box
        sx={{
            display: 'flex',
            textAlign: 'center',
            flexWrap: 'wrap',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            '& > :not(style)': {
            m: 0,  
            width: 380,
            height: "100%",
            },
            '& .MuiFormLabel-root':{
                fontFamily:'font1',
            },
            '& fieldset':{border:'none'},
            "& label": {
                width: "100%",
                textAlign: "right",
                transformOrigin: "center",
            },
        }}
    >
        <Paper elevation={3} sx={{borderRadius: 5}}>
            <Typography sx={{margin:'30px 0px 25px 0px', fontFamily:'font1' , fontSize:29 , color:'black'}}>
                به ساختمان خوش آمدید !
            </Typography>
            <TabsCustom />
        </Paper>
    </Box>
  );
}