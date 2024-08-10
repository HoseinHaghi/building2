import React from 'react';
import Button from '@mui/material/Button';
import { styled } from '@mui/system';

const StyledButton = styled(Button)(({ theme }) => ({
  backgroundColor: "#FF4500",
  color: "white",
  width: "88%",
  height: "40px",
  marginTop: "25px",
  borderRadius: "8px",
  fontFamily: "font1",
  ":hover": {
    backgroundColor: "#FF8C00"
  }
}));

export default function EndButtons({ title }) {
  return (
    <StyledButton variant="text">
      {title}
    </StyledButton>
  );
}