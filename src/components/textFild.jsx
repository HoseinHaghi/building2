import * as React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';

const backColor = "#F5F5F5";

export default function TextFields(props) {
  return (
    <Box
      sx={{
        '& > :not(style)': { 
            m: 1,
            marginBottom: props.margin,
            width: '300px', 
            height: '50px', 
            direction: 'rtl', 
            backgroundColor: backColor,
            borderRadius: '40px',
        },
      }}
    >
      <TextField label = {props.title} sx={{direction: 'rtl', borderRadius: '40px'}}/>
    </Box>
  );
}
