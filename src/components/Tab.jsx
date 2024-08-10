import * as React from 'react';
import TextFields from './textFild';
import EndButtons from './EndButtons';
import { Typography } from '@mui/material';
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import { styled } from '@mui/system';

const StyledTabList = styled(TabList)(({ theme }) => ({
  '& > :not(style)': {
    marginRight: theme.spacing(5),
  },
  '.css-1euq74i-MuiButtonBase-root-MuiTab-root.Mui-selected': {
    color: 'white',
    backgroundColor: '#FF4500',
  }
}));

const StyledTab = styled(Tab)(({ theme }) => ({
  fontFamily: 'font1',
  borderRadius: '40px',
  backgroundColor: '#F5F5F5',
  width: '150px',
  height: '50px',

}));

const StyledTypography = styled(Typography)(({ theme }) => ({
  margin: '0px 25px 7px 10px',
  fontFamily: 'font1',
  fontSize: 17,
  color: 'black',
}));

export default function TabsCustom() {
  const [value, setValue] = React.useState('1');

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  return (
    <TabContext value={value}>
      <StyledTabList onChange={handleChange} indicatorColor='none'>
        <StyledTab label="ورود" value="1" />
        <StyledTab label="ثبت نام" value="2" />
      </StyledTabList>
      <TabPanel value="1">
        <StyledTypography>
          لطفا اطلاعات زیر را پر کنید .
        </StyledTypography>
        <TextFields title="نام کاربری" margin="20px" />
        <TextFields title="رمز عبور" margin="20px" />
        <EndButtons title="وارد شوید" margin="20px" />
      </TabPanel>
      <TabPanel value="2">
        <StyledTypography>
          لطفا اطلاعات زیر را پر کنید .
        </StyledTypography>
        <TextFields title="نام" margin="0px" />
        <TextFields title="نام خانوادگی" margin="0px" />
        <TextFields title="نام کاربری" margin="0px" />
        <TextFields title="رمز عبور" margin="0px" />
        <TextFields title="تکرار رمز عبور" margin="0px" />
        <EndButtons title="ثبت نام" margin="0px" />
      </TabPanel>
    </TabContext>
  );
}
