import { styled } from '@mui/system';

const CircleStyle = styled('div')({
    height:'51px' ,
    width:'51px',
    backgroundColor: '#F15F2B',
    borderRadius: '50%',
    textAlign:'center',
    position:'relative',
});
const FrameStyle = styled('div')({
    display:'flex',
    backgroundColor:'#FFFFFF',
    columnGap:'16px', 
    padding:'16px 8px',
    alignItems:'center',
    minWidth:'184px' ,
    maxWidth:'100%',
});
const TypographyNumStyle = styled('typography')({
    margin:'0px',
    position:'absolute',
    top:'50%',
    left:'50%',
    transform:"translate(-50%, -50%)",
    color:'white',
    fontSize:'25px'
});
const TypographyStrStyle = styled('typography')({
    fontFamily:'font1',
    fontSize:'18px'
});

export default function FloorNumber({fnum}) {

    const floorInformation=[
        {FloorNum:"۱" ,FloorLable:"تولید محتوا"},
        {FloorNum:"۲" ,FloorLable:"کارآموز"},
        {FloorNum:"۳" ,FloorLable:"توسعه دهنده"},
        {FloorNum:"۴" ,FloorLable:"خلاقیت"},
        {FloorNum:"۵" ,FloorLable:"مسئله علمی"},
        {FloorNum:"۶" ,FloorLable:"مدیریت"},
        {FloorNum:"۷" ,FloorLable:"طرح مسئله"}]

    if(fnum==1){
        return (
        <FrameStyle style={{borderRadius: '0px 8px 0px 0px'}}>
        <CircleStyle>
            <TypographyNumStyle>{floorInformation[fnum-1].FloorNum}</TypographyNumStyle>
        </CircleStyle>
            <TypographyStrStyle>{floorInformation[fnum-1].FloorLable}</TypographyStrStyle>
        </FrameStyle>
    )}
    else if(fnum==7){
        return (
            <FrameStyle style={{borderRadius:'0 0 8px 0'}}>
            <CircleStyle>
                <TypographyNumStyle>{floorInformation[fnum-1].FloorNum}</TypographyNumStyle>
            </CircleStyle>
                <TypographyStrStyle>{floorInformation[fnum-1].FloorLable}</TypographyStrStyle>
            </FrameStyle>
    )}else{
        return (
            <FrameStyle>
            <CircleStyle>
                <TypographyNumStyle>{floorInformation[fnum-1].FloorNum}</TypographyNumStyle>
            </CircleStyle>
                <TypographyStrStyle>{floorInformation[fnum-1].FloorLable}</TypographyStrStyle>
            </FrameStyle>
    )}
  }