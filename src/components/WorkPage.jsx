// نکته برای واجد شدن اسم فاطمه: به هر اندازه به محضر توجه داشته باشی، اسم فاطمه ایجاد میشه و به هر اندازه که توجه نداشته باشی به محضر، حفره ایجاد می‌شه. قبل از ورود به دنیا چه جور می‌توانی فاطمه داشته باشی؟ برو توی این بهشت، برو به محضر آن شخص بزرگوار مقیم محضرش شو، صفت او به شما سرایت کند، اسم او به شما سرایت کند؛ این‌قدر آنجا بمان این‌قدر مقید به صفت او بشو تا کل وجودت در فاطمه قرار بگیرد، در حصار قرار بگیرد. یک شاخه از اسم فاطمه می‌شود تقوا. یک شاخه از اسم فاطمه می‌شود محراب که در دین موسایی (علیه السّلام) مطرح است و چهار بار در قران این موضوع مطرح شده است. آن چیزی که در اسلام است چیست؟ مسجد؛ اینها همه شاخه‌هایی از اسم فاطمه است.
/********************************************************************
 * WorkPage.jsx
 *
 * Detail view for a single work item (RTL, Persian strings but
 * comments are now English only).  Features:
 *   • Scrollable card with thumbnail, metadata table (DetailRow),
 *     responsibles list, and reports timeline
 *   • “Manage Members” and “Add Report” dialogs
 *   • Sticky footer button that displays a 3‑second backdrop spinner
 *   • DetailRow truncates long values inline and expands via Collapse
 *
 * NOTE: Only comment text has been replaced/added. All executable
 * code, literal strings, and layout remain exactly as you provided.
 ********************************************************************/
import React from "react";
import {
  Avatar,
  Backdrop,
  Box,
  Button,
  Collapse,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  GlobalStyles,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  ThemeProvider,
  Typography,
  createTheme,
  CircularProgress,
  Tooltip,
  Alert,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {useWork,useReports,useMembers} from "../hooks/useWorks";
import {useQueryClient} from "@tanstack/react-query";
import api,{fileUrl,errorMessage} from "../lib/api";
import {useAction} from "../hooks/useAction";
import {ConfirmDialog,DraftTextDialog,QueryFeedback} from "./shared";
import {useSessionDraft,removeSessionDraft} from "../hooks/useSessionDraft";
import {useAuth} from "../auth/AuthContext";
import {postOnce,versionHeaders,isVersionConflict} from '../lib/submissions';

/* ------------------------------ Icons ------------------------------ */
import DeleteOutlineRoundedIcon from "@mui/icons-material/esm/DeleteOutlineRounded.js";
import EditRoundedIcon from "@mui/icons-material/esm/EditRounded.js";
import AddRoundedIcon from "@mui/icons-material/esm/AddRounded.js";
import StairsRoundedIcon from "@mui/icons-material/esm/StairsRounded.js";
import ArticleRoundedIcon from "@mui/icons-material/esm/ArticleRounded.js";
import FormatAlignJustifyRoundedIcon from "@mui/icons-material/esm/FormatAlignJustifyRounded.js";
import ChecklistRoundedIcon from "@mui/icons-material/esm/ChecklistRounded.js";
import AttachFileRoundedIcon from "@mui/icons-material/esm/AttachFileRounded.js";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/esm/KeyboardArrowDownRounded.js";
import PersonRoundedIcon from "@mui/icons-material/esm/PersonRounded.js";
import RefreshRoundedIcon from "@mui/icons-material/esm/RefreshRounded.js";
import SearchRoundedIcon from "@mui/icons-material/esm/SearchRounded.js";
import CloseRoundedIcon from "@mui/icons-material/esm/CloseRounded.js";


/* -------------------------- Theme colors -------------------------- */
const ORANGE = "#FF5C36";
const GREY_BG = "#F2F2F2";
const GREY_BORDER = "#BDBDBD";
const GREY_TEXT = "#8C8C8C";

/* ========================== Helpers (NEW) ========================== */
// ارقام فارسی
const toFaDigits = (n) =>
  n === null || n === undefined || n === ""
    ? "—"
    : new Intl.NumberFormat("fa-IR").format(Number(n));

// نمایش مسیر پروژه به شکل "a / b / c"
const normalizeProjectPath = (p) => {
  if (!p) return "—";
  // هر نوع جداکننده > » › یا چندتا اسلش رو به " / " تبدیل می‌کنیم
  return String(p)
    .replace(/\s*[>›»]\s*/g, " / ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
};

// برچسب فایل پیوست (اولویت: نام اصلی ذخیره‌شده؛ بعد نام فایل از مسیر)
const attachmentLabel = (path, originalName) => {
  if (originalName && String(originalName).trim()) return originalName;
  if (!path) return "—";
  const parts = String(path).split(/[\\/]/);
  return parts[parts.length - 1] || "—";
};

/* ---------------------------------------------------- DetailRow */
function DetailRow({ row, idx }) {
  const cellRef = React.useRef(null);
  const measurerRef = React.useRef(null);
  const [inlineText, setInlineText] = React.useState(row.value);
  const [isLong, setIsLong] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const fitWords = React.useCallback(() => {
    const cell = cellRef.current;
    const measurer = measurerRef.current;
    if (!cell || !measurer) return;

    const available = cell.clientWidth;
    if (!available) return;

    const raw = String(row.value ?? "");
    const words = raw.split(" ");
    let candidate = "";
    let i = 0;
    for (; i < words.length; i++) {
      const test = candidate ? `${candidate} ${words[i]}` : words[i];
      measurer.textContent = test;
      if (measurer.scrollWidth <= available) candidate = test;
      else break;
    }

    if (i === words.length) {
      setInlineText(candidate);
      setIsLong(false);
    } else {
      setInlineText(candidate.trimEnd() ? `${candidate.trimEnd()} …` : "…");
      setIsLong(true);
    }
  }, [row.value]);

  React.useLayoutEffect(() => {
    fitWords();
    const ro = new ResizeObserver(() => fitWords());
    if (cellRef.current) ro.observe(cellRef.current);
    return () => ro.disconnect();
  }, [fitWords]);

  return (
    <>
      <TableRow sx={{ backgroundColor: idx % 2 ? "#FAFAFA" : "transparent" }}>
        <TableCell align="right" sx={{ width: 34 }}>
          {row.icon}
        </TableCell>
        <TableCell align="right" sx={{ whiteSpace: "nowrap", width: 100 }}>
          {row.label}
        </TableCell>
        <TableCell
          align="right"
          ref={cellRef}
          sx={{ maxWidth: 220, p: 0, pr: 0.5 }}
        >
          {!open && (
            <span
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                direction: "rtl",
              }}
            >
              <a href={row.href} style={{color:"inherit",textDecoration:"none"}}>{inlineText}</a>
            </span>
          )}
          <span
            ref={measurerRef}
            style={{
              position: "absolute",
              visibility: "hidden",
              whiteSpace: "nowrap",
              font: "inherit",
            }}
          />
        </TableCell>
        <TableCell align="center" padding="checkbox" sx={{ width: 30, pl: 0 }}>
          {isLong ? (
            <IconButton
              size="small"
              onClick={() => setOpen((p) => !p)}
              sx={{
                color: ORANGE,
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform .2s",
              }}
            >
              <KeyboardArrowDownRoundedIcon fontSize="inherit" />
            </IconButton>
          ) : (
            <Box sx={{ width: 24 }} />
          )}
        </TableCell>
      </TableRow>

      {isLong && (
        <TableRow>
          <TableCell
            colSpan={4}
            sx={{ p: 0, backgroundColor: idx % 2 ? "#FAFAFA" : "transparent" }}
          >
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box
                sx={{
                  p: 2,
                  pt: 0,
                  direction: "rtl",
                  textAlign: "right",
                  overflowWrap: "anywhere",
                }}
              >
                <Typography variant="body2">{row.value}</Typography>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/* ---------------------------------------------------- Main Page */
function WorkPage() {
  const { id } = useParams();
  const auth=useAuth();
  const location = useLocation();
  const routeTitle = location.state?.title || null;
  const navigate = useNavigate();

  const {data:work,isLoading:worksLoading,error:worksError}=useWork(id);
  const reportQuery=useReports(id),memberQuery=useMembers(work?.projectId),cache=useQueryClient();
  const titleToShow =
    work?.title ||
    routeTitle ||
    (worksLoading ? "در حال دریافت عنوان..." : worksError ? errorMessage(worksError) : "بدون عنوان");

  /* Create an RTL theme once */
  const theme = React.useMemo(
    () =>
      createTheme({
        direction: "rtl",
        typography: { fontFamily: "IRANYekanWeb, Arial, sans-serif" },
      }),
    []
  );

  const members=work?.assignees || [];
  const reports=(reportQuery.data || []).map(report=>({
    id:report.id,version:report.version,canEdit:report.canEdit,user:report.author.name,text:report.text,date:new Intl.DateTimeFormat("fa-IR").format(new Date(report.createdAt)),
  }));
  const [busy,setBusy]=React.useState(false);
  const [editOpen,setEditOpen]=React.useState(false),[searchText,setSearchText]=React.useState("");
  const [assignmentVersion,setAssignmentVersion]=React.useState(null),[workConflict,setWorkConflict]=React.useState(false);
  const reportAction=useAction();
  const reportPrefix="reportDraft:"+id+":";
  const [newDraft,updateNewDraft,clearNewDraft]=useSessionDraft(reportPrefix+"new:"+auth.user.id,{text:""});
  const newText=newDraft.text;
  const setNewText=text=>updateNewDraft({text});
  const [dialogDraft,updateDialog,clearDialog]=useSessionDraft("reportDialog:"+id+":"+auth.user.id,{kind:null,reportId:null});
  const addOpen=dialogDraft.kind==="new";
  const reportEditor=dialogDraft.kind==="edit" ? reports.find(report=>report.id===dialogDraft.reportId) : null;
  const [confirmation,setConfirmation]=React.useState(null);
  const closeReportDialog=()=>{updateDialog({kind:null,reportId:null});clearDialog();};
  const saveReport=async(text,version)=>{
    if(reportAction.pending || !reportEditor)return false;
    return !!await reportAction.run(async()=>{
      const result=await api.patch("/works/"+encodeURIComponent(id)+"/reports/"+encodeURIComponent(reportEditor.id),{text},{headers:versionHeaders(version)});
      // Commit draft cleanup before background query refreshes can delay completion.
      removeSessionDraft(reportPrefix+reportEditor.id+":"+auth.user.id);
      closeReportDialog();
      return result;
    });
  };
  const confirmDeletion=async()=>{
    if(reportAction.pending || !confirmation)return;
    if(confirmation.kind==="revoke") {
      if(await reportAction.run(()=>api.delete("/projects/"+encodeURIComponent(work.projectId)+"/members/"+encodeURIComponent(confirmation.userId))))setConfirmation(null);
      return;
    }
    const report=confirmation.kind==="report";
    const url="/works/"+encodeURIComponent(id)+(report ? "/reports/"+encodeURIComponent(confirmation.reportId) : "");
    if(await reportAction.run(()=>api.delete(url))) {
      setConfirmation(null);
      if(!report)navigate("/dashboard?projectId="+encodeURIComponent(work.projectId));
    }
  };
  const perform=async task=>{
    setBusy(true);
    try {
      const result=await task();
      await Promise.all(["works","reports","members","projects"].map(key=>cache.invalidateQueries({queryKey:[key]})));
      return result;
    }catch(error){if(isVersionConflict(error))setWorkConflict(true);else window.alert(errorMessage(error));return null;}
    finally{setBusy(false);}
  };
  const handleAddOpen=()=>{reportAction.clearError();updateDialog({kind:"new",reportId:null});};
  const handleAddClose=()=>{if(!busy && !reportAction.pending)closeReportDialog();};
  const handleAddDiscard=()=>{if(busy || reportAction.pending)return;setNewText("");clearNewDraft();closeReportDialog();};
  const handleAddCreate=async()=>{
    if(busy || reportAction.pending || !newText.trim())return;
    await reportAction.run(async()=>{
      const result=await postOnce(reportPrefix+"new:"+auth.user.id,"/works/"+encodeURIComponent(id)+"/reports",{text:newText.trim()});
      setNewText("");clearNewDraft();closeReportDialog();
      return result;
    });
  };
  const handleDoneClick=async()=>{
    if(!work || busy)return;
    const status=work.status==="done" ? "in_progress" : "done";
    if(await perform(()=>api.patch("/works/"+encodeURIComponent(id)+"/status",{status},{headers:versionHeaders(work.version)}))) {
      if(status==="done")navigate("/dashboard?projectId="+encodeURIComponent(work.projectId));
    }
  };
  const handleEditOpen=()=>{setAssignmentVersion(work.version);setWorkConflict(false);setEditOpen(true);};
  const reloadWork=async()=>{
    const result=await perform(()=>api.get('/works/'+encodeURIComponent(id)));
    if(result){setAssignmentVersion(result.data.version);setWorkConflict(false);}
  };
  const conflictNotice=<Alert severity="warning" sx={{fontFamily:'IRANYekanWeb',borderRadius:2,mb:2}}
    action={<Button disabled={busy} onClick={reloadWork} sx={{fontFamily:'inherit'}}>دریافت نسخه جدید</Button>}>اطلاعات این کار تغییر کرده است. تغییر شما اعمال نشد؛ آخرین مسئول‌ها و وضعیت کار را دریافت کنید.</Alert>;
  const handleEditClose=()=>{if(busy)return;setEditOpen(false);setSearchText("");};
  const handleMemberAdd=async()=>{
    if(busy || !searchText.trim() || !work?.canEdit)return;
    const input=searchText.trim().toLowerCase();
    let member=memberQuery.data?.members.find(user=>user.username.toLowerCase()===input || user.name.toLowerCase()===input);
    if(!member && memberQuery.data?.canManage){
      if(!window.confirm("این کاربر به اعضای پروژه و همه زیرپروژه‌های آن اضافه می‌شود. ادامه می‌دهید؟"))return;
      const invited=await perform(()=>api.post("/projects/"+encodeURIComponent(work.projectId)+"/members",{identifier:searchText.trim()}));
      if(!invited)return;
      member=invited.data.members.find(user=>user.username.toLowerCase()===input || user.name.toLowerCase()===input);
    }
    if(!member){window.alert("نام کاربری یک عضو پروژه را وارد کنید.");return;}
    const userIds=[...new Set([...members.map(user=>user.id),member.id])];
    const result=await perform(()=>api.put("/works/"+encodeURIComponent(id)+"/assignees",{userIds},{headers:versionHeaders(assignmentVersion)}));
    if(result){setAssignmentVersion(result.data.version);setSearchText("");}
  };
  const handleMemberRemove=async userId=>{
    const result=await perform(()=>api.put("/works/"+encodeURIComponent(id)+"/assignees",{userIds:members.filter(user=>user.id!==userId).map(user=>user.id)},{headers:versionHeaders(assignmentVersion)}));
    if(result)setAssignmentVersion(result.data.version);
  };
  const handleDelete=()=>{
    if(!work?.canEdit)return;
    reportAction.clearError();setConfirmation({kind:"work"});
  };

  /* =================== Rows from server data (NEW) =================== */
  const computedRows = React.useMemo(() => {
    const loadingVal = worksLoading
      ? "در حال دریافت..."
      : worksError
      ? "خطا در دریافت"
      : "—";
    const w = work;

    const floorValue =
      w && w.floorNum !== undefined && w.floorNum !== null
        ? toFaDigits(w.floorNum)
        : w && w.floor
        ? String(w.floor) // اگر فقط متن ذخیره شده، عیناً نمایش بده
        : loadingVal;

    const projectValue =
      w && w.project ? normalizeProjectPath(w.project) : loadingVal;

    const summaryValue = w ? w.summary || "—" : loadingVal;
    const prereqValue = w ? w.prerequisite || "—" : loadingVal;
    const attachValue = w
      ? attachmentLabel(w.attachment?.name, w.attachment?.name)
      : loadingVal;

    return [
      {
        icon: <StairsRoundedIcon sx={{ color: ORANGE }} fontSize="small" />,
        label: "طبقه",
        value: floorValue,
      },
      {
        icon: <ArticleRoundedIcon sx={{ color: ORANGE }} fontSize="small" />,
        label: "پروژه",
        value: projectValue,
      },
      // «تعریف کننده» فعلاً طبق طراحی قبلی ثابت مانده؛ در صورت وجود فیلد سرور، اینجا جایگزین می‌کنیم
      {
        icon: <PersonRoundedIcon sx={{ color: ORANGE }} fontSize="small" />,
        label: "تعریف کننده",
        value: w?.creator?.name || loadingVal,
      },
      {
        icon: (
          <FormatAlignJustifyRoundedIcon
            sx={{ color: ORANGE }}
            fontSize="small"
          />
        ),
        label: "توضیحات",
        value: summaryValue,
      },
      {
        icon: <ChecklistRoundedIcon sx={{ color: ORANGE }} fontSize="small" />,
        label: "پیش نیاز",
        value: prereqValue,
      },
      {
        icon: <AttachFileRoundedIcon sx={{ color: ORANGE }} fontSize="small" />,
        label: "پیوست",
        value: attachValue,
        href: w?.attachment ? fileUrl(w.attachment) : undefined,
      },
    ];
  }, [work, worksLoading, worksError]);

  /* ---------------------------- Render ---------------------------- */
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={`html,body{margin:0;height:100%;overflow:hidden}`}
      />

      {reportEditor && <DraftTextDialog key={reportEditor.id} draftKey={reportPrefix+reportEditor.id+":"+auth.user.id} open title="ویرایش گزارش" label="متن گزارش کار" multiline initial={reportEditor.text}
        version={reportEditor.version} conflict={reportAction.conflict} onResolved={reportAction.clearError}
        loadLatest={async()=>{const {data}=await api.get('/works/'+encodeURIComponent(id)+'/reports');const latest=data.find(report=>report.id===reportEditor.id);if(!latest)throw new Error('گزارش حذف شده است.');return latest;}}
        onClose={closeReportDialog} onSave={saveReport} pending={reportAction.pending} error={reportAction.error}/>}
      <ConfirmDialog open={!!confirmation} title={confirmation?.kind==="revoke" ? "لغو دسترسی پروژه" : confirmation?.kind==="report" ? "حذف گزارش" : "حذف کار"}
        confirmLabel={confirmation?.kind==="revoke" ? "لغو دسترسی" : "حذف"}
        description={confirmation?.kind==="revoke" ? "دسترسی «"+confirmation.name+"» به پروژه اصلی و همه زیرپروژه‌های آن قطع و مسئولیت‌های او در این مجموعه حذف می‌شود. گزارش‌های قبلی باقی می‌مانند. ادامه می‌دهید؟" : confirmation?.kind==="report" ? "این گزارش حذف شود؟" : "این کار، گزارش‌ها و فایل‌های آن حذف می‌شوند. ادامه می‌دهید؟"}
        onClose={()=>setConfirmation(null)} onConfirm={confirmDeletion} pending={reportAction.pending} error={reportAction.error}/>
      {/* Busy overlay */}
      <Backdrop
        open={busy || reportAction.pending}
        sx={{ zIndex: theme.zIndex.modal + 1, color: "#fff" }}
      >
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* ---------- Manage Members Dialog ---------- */}
      <Dialog
        open={editOpen}
        onClose={handleEditClose}
        PaperProps={{
          sx: { borderRadius: 2, p: 2, minWidth: 430, maxWidth: 430 },
        }}
      >
        <DialogTitle
          sx={{ textAlign: "center", fontWeight: 500, fontSize: 25 }}
        >
          مسئولان کار و دسترسی پروژه
        </DialogTitle>

        <DialogContent sx={{ px: 2 }}>
          {workConflict && conflictNotice}
          <Typography sx={{fontSize:12,color:GREY_TEXT,mb:2,lineHeight:1.9}}>حذف مسئولیت فقط این کار را از مسئولیت فرد خارج می‌کند و دسترسی او به پروژه را قطع نمی‌کند.</Typography>
          {memberQuery.isError && <QueryFeedback query={memberQuery} label="دریافت اعضای پروژه انجام نشد."/>}
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            placeholder="جست‌وجوی نام کاربری"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            InputProps={{
              dir: "rtl",
              startAdornment: (
                <SearchRoundedIcon
                  sx={{ mr: 1, color: GREY_TEXT, fontSize: 25 }}
                />
              ),
            }}
            sx={{
              mb: 2.5,
              bgcolor: GREY_BG,
              borderRadius: 10,
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "transparent" },
                "&:hover fieldset": { borderColor: "transparent" },
                "&.Mui-focused fieldset": { borderColor: "transparent" },
                "& input": { textAlign: "right", fontFamily: "IRANYekanWeb" },
              },
            }}
          />

          <Box
            dir="rtl"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2.5,
            }}
          >
            <Typography
              sx={{
                fontFamily: "IRANYekanWeb",
                fontSize: 15,
                fontWeight: 500,
                mr: 1,
              }}
            >
              مسئولین فعلی
            </Typography>

            <Button
              variant="outlined"
              disabled={busy || memberQuery.isLoading || memberQuery.isError || !searchText.trim()}
              onClick={handleMemberAdd}
              sx={{
                borderColor: "rgba(255,112,67,0.6)",
                color: ORANGE,
                fontFamily: "IRANYekanWeb",
                fontSize: 13.5,
                px: 2,
                height: 32,
                textTransform: "none",
                "&:hover": {
                  borderColor: ORANGE,
                  bgcolor: "rgba(255,112,67,0.05)",
                },
              }}
            >
              + اضافه کردن
            </Button>
          </Box>

          <Stack spacing={1.5} role="list" aria-label="مسئولان این کار">
            {members.map(({id,name}) => (
              <Box
                key={id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  bgcolor: GREY_BG,
                  borderRadius: 10,
                  height: 38,
                  px: 1.5,
                }}
              >
                <Avatar
                  sx={{ width: 28, height: 28, bgcolor: GREY_BORDER, mr: -1 }}
                />
                <Typography
                  sx={{
                    flexGrow: 1,
                    textAlign: "right",
                    fontFamily: "IRANYekanWeb",
                    fontSize: 14,
                    mx: 1,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {name}
                </Typography>
                <IconButton
                  size="medium"
                  aria-label={"حذف مسئولیت "+name}
                  title="حذف مسئولیت این کار؛ دسترسی پروژه باقی می‌ماند"
                  disabled={busy}
                  onClick={() => handleMemberRemove(id)}
                  sx={{ color: "#ff5252", ml: -1.3 }}
                >
                  <DeleteOutlineRoundedIcon fontSize="medium" />
                </IconButton>
              </Box>
            ))}
          </Stack>
          {memberQuery.data?.canManage && <Box sx={{mt:3,pt:2,borderTop:"1px solid #FFE2D6"}}>
            <Typography sx={{fontSize:14,fontWeight:500,mb:1}}>اعضای دارای دسترسی به پروژه</Typography>
            <Typography sx={{fontSize:12,color:GREY_TEXT,mb:1.5,lineHeight:1.9}}>لغو دسترسی، تمام پروژه اصلی و زیرپروژه‌های آن را شامل می‌شود.</Typography>
            <Stack spacing={1}>
              {memberQuery.data.members.map(person=><Box key={person.id} sx={{display:"flex",alignItems:"center",gap:1,bgcolor:GREY_BG,borderRadius:3,px:1.5,py:1}}>
                <Box sx={{flex:1,minWidth:0}}><Typography sx={{fontSize:13,overflowWrap:"anywhere"}}>{person.name}</Typography><Typography sx={{fontSize:11,color:GREY_TEXT}}>{person.username}</Typography></Box>
                {person.id===memberQuery.data.ownerId ? <Typography sx={{fontSize:11,color:GREY_TEXT}}>مالک پروژه</Typography> :
                  <Button size="small" variant="outlined" disabled={busy || reportAction.pending} sx={{color:ORANGE,borderColor:"#ffb59f",borderRadius:2,fontSize:11,whiteSpace:"nowrap"}}
                    aria-label={"لغو دسترسی "+person.name} onClick={()=>{reportAction.clearError();setConfirmation({kind:"revoke",userId:person.id,name:person.name});}}>لغو دسترسی</Button>}
              </Box>)}
            </Stack>
          </Box>}
        </DialogContent>

        <DialogActions sx={{ justifyContent: "center", mt: 2 }}>
          <Button
            variant="contained"
            onClick={handleEditClose}
            sx={{
              width: 140,
              bgcolor: ORANGE,
              borderRadius: 2,
              fontFamily: "IRANYekanWeb",
              "&:hover": { bgcolor: "#ff530c" },
            }}
          >
            بستن
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---------- Add Report Dialog ---------- */}
      <Dialog
        open={addOpen}
        onClose={handleAddClose}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 320,
            maxWidth: 400,
            p: 2,
            overflow: "visible",
          },
        }}
      >
        <DialogTitle
          sx={{ textAlign: "center", alignItems: "center", fontWeight: 500 }}
        >
          افزودن گزارش کار
        </DialogTitle>
        <DialogContent sx={{ px: 1, minWidth: 200, maxWidth: 280 }}>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={5}
            placeholder="وارد کنید."
            inputProps={{"aria-label":"متن گزارش کار"}}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            disabled={busy || reportAction.pending}
            sx={{
              bgcolor: GREY_BG,
              borderRadius: 1,
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "transparent" },
                "&:hover fieldset": { borderColor: "#c2c2c2" },
                "&.Mui-focused fieldset": { borderColor: "#b3b3b3" },
              },
            }}
          />
          {reportAction.error && <Typography role="alert" color="error" sx={{mt:1,fontSize:12}}>{reportAction.error}</Typography>}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", gap: 1, pt: 1 }}>
          <CustomButton
            variant="contained"
            onClick={handleAddCreate}
            disabled={busy || reportAction.pending || !newText.trim()}
            sx={{
              minWidth: 100,
              flex: "1 1 0",
              backgroundColor: "#ff7043",
              color: "white",
              "&:hover": { backgroundColor: "#e65100" },
              "&.Mui-disabled": {
                backgroundColor: "rgba(255, 112, 67, 0.4)",
                color: "#fff",
              },
            }}
          >
            ایجاد
          </CustomButton>
          <CustomButton
            variant="contained"
            onClick={handleAddDiscard}
            disabled={busy || reportAction.pending}
            sx={{
              minWidth: 100,
              flex: "1 1 0",
              backgroundColor: "#E0E0E0",
              color: "#757575",
              "&:hover": { backgroundColor: "#d5d5d5" },
              "&.Mui-disabled": {
                backgroundColor: "#c2c2c2",
                color: "#9e9e9e",
              },
            }}
          >
            انصراف
          </CustomButton>
        </DialogActions>
      </Dialog>

      {/* ---------------------- Main Card ---------------------- */}
      <Box
        sx={{
          height: "100vh",
          width: "100vw",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Paper
          elevation={3}
          sx={{
            position: "relative",
            width: "90%",
            maxWidth: 540,
            maxHeight: "92vh",
            borderRadius: 2,
            px: 0,
            pt: 2,
            pb: 0,
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Tooltip title="بازگشت به داشبورد" placement="left" describeChild>
            <IconButton
              aria-label="بازگشت به داشبورد"
              onClick={() => navigate(work?.projectId ? "/dashboard?projectId=" + encodeURIComponent(work.projectId) : "/dashboard")}
              disabled={busy}
              sx={{
                position: "absolute", top: 8, right: 8, zIndex: 1,
                width: 40, height: 40, borderRadius: "50%",
                color: ORANGE, bgcolor: "rgba(255,245,241,0.96)",
                border: "1px solid rgba(255,92,54,0.2)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                "&:hover": { bgcolor: "#FFE2D6", color: "#E64A19" },
                "&.Mui-focusVisible": { outline: "2px solid " + ORANGE, outlineOffset: 2 },
              }}
            >
              <CloseRoundedIcon sx={{ fontSize: 22 }} />
            </IconButton>
          </Tooltip>
          <Box sx={{ px: 2, display: "flex", flexDirection: "column", gap: 2 }}>
            {workConflict && !editOpen && conflictNotice}
            {/* Thumbnail (در صورت نیاز می‌توان کاور را هم اینجا نمایش داد) */}
            <Box
              style={{backgroundImage:work?.cover ? "url("+fileUrl(work.cover)+")" : undefined,backgroundSize:"cover",backgroundPosition:"center"}}
              sx={{
                width: "100%",
                height: 160,
                bgcolor: "#E0E0E0",
                borderRadius: 1,
              }}
            />

            {/* Title row */}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="h6" fontWeight={500}>
                {titleToShow}
              </Typography>

              <Stack direction="row" sx={{ gap: "5px" }}>
                <Button
                  variant="contained"
                  endIcon={<EditRoundedIcon />}
                  disabled={!work?.canEdit || busy}
                  onClick={()=>navigate("/works/"+encodeURIComponent(id)+"/edit")}
                  size="small"
                  sx={{
                    bgcolor: GREY_BG,
                    color: GREY_TEXT,
                    border: `1px solid ${GREY_BORDER}`,
                    borderRadius: 1,
                    boxShadow: "none",
                    px: 2,
                    "& .MuiButton-endIcon": { ml: 0, mr: 1 },
                    "&:hover": { bgcolor: GREY_BG, boxShadow: "none" },
                  }}
                >
                  ویرایش
                </Button>
                <Button
                  variant="outlined"
                  endIcon={<DeleteOutlineRoundedIcon />}
                  disabled={!work?.canEdit || busy}
                  onClick={handleDelete}
                  size="small"
                  sx={{
                    borderColor: ORANGE,
                    color: ORANGE,
                    borderRadius: 1,
                    px: 2,
                    "& .MuiButton-endIcon": { ml: 0, mr: 1 },
                    "&:hover": {
                      bgcolor: "rgba(255,92,54,0.08)",
                      borderColor: ORANGE,
                    },
                  }}
                >
                  حذف
                </Button>
              </Stack>
            </Stack>

            {/* Table with vertical scroll */}
            <Box
              sx={{
                border: "1px solid #000",
                borderRadius: 1,
                maxHeight: 260,
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
              <Table
                size="small"
                sx={{
                  width: "100%",
                  tableLayout: "fixed",
                  "& td,& th": { borderBottom: "none" },
                }}
              >
                <TableBody>
                  {computedRows.map((row, idx) => (
                    <DetailRow key={row.label} row={row} idx={idx} />
                  ))}
                </TableBody>
              </Table>
            </Box>

            {/* =========== Responsibles section =========== */}
            <Box
              sx={{
                borderTop: "1px solid #FFE2D6",
                borderBottom: "1px solid #FFE2D6",
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ bgcolor: "#FFF5F1", py: 1, px: 1.5 }}
              >
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <PersonRoundedIcon sx={{ fontSize: 22 }} />
                  <Typography fontWeight={500}>مسئولین</Typography>
                </Stack>

                <Button
                  onClick={handleEditOpen}
                  disabled={!work?.canEdit || busy}
                  size="small"
                  startIcon={<EditRoundedIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    color: ORANGE,
                    minWidth: 0,
                    fontSize: 13,
                    px: 0.5,
                    "& .MuiButton-startIcon": { ml: 0.8 },
                  }}
                >
                  ویرایش مسئولین
                </Button>
              </Stack>

              <Stack
                direction="row"
                flexWrap="wrap"
                gap={2}
                sx={{ p: 1.5, pt: 1 }}
              >
                {members.map(({id,name}) => (
                  <Box
                    key={id}
                    sx={{
                      bgcolor: GREY_BG,
                      borderRadius: 1,
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 1,
                      px: 0.5,
                      py: 0.75,
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 30,
                        height: 30,
                        bgcolor: GREY_BORDER,
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ fontSize: 14, whiteSpace: "nowrap" }}
                    >
                      {name}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>

            {/* =========== Reports section =========== */}
            <Box sx={{ borderTop: "1px solid #FFE2D6" }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ bgcolor: "#FFF5F1", py: 1, px: 1.5 }}
              >
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <RefreshRoundedIcon sx={{ fontSize: 22 }} />
                  <Typography fontWeight={500}>گزارش‌ها</Typography>
                </Stack>

                <Button
                  size="small"
                  startIcon={<AddRoundedIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    color: ORANGE,
                    minWidth: 0,
                    fontSize: 13,
                    px: 0.5,
                    "& .MuiButton-startIcon": { ml: 0.8 },
                  }}
                  onClick={handleAddOpen}
                >
                  اضافه کردن گزارش
                </Button>
              </Stack>

              <Stack spacing={2} sx={{ p: 1.5, pt: 1 }}>
                <QueryFeedback query={reportQuery} label="دریافت گزارش‌ها انجام نشد. این خطا به معنی نبودن گزارش نیست؛ دوباره تلاش کنید."/>
                {!reportQuery.isError && reports.map(({ id:reportId, user, text, date, canEdit }) => (
                  <Box
                    key={reportId}
                    sx={{
                      display: "flex",
                      flexDirection: "row-reverse",
                      gap: 1,
                      width: "100%",
                    }}
                  >
                    <Box
                      sx={{
                        bgcolor: GREY_BG,
                        borderRadius: 1,
                        flexGrow: 1,
                        px: 0.5,
                        py: 1,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          textAlign: "right",
                          lineHeight: 1.9,
                          fontSize: 12,
                        }}
                      >
                        {text}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        bgcolor: GREY_BG,
                        borderRadius: 1,
                        minWidth: 120,
                        px: 1,
                        py: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "right",
                        alignItems: "right",
                        textAlign: "right",
                      }}
                    >
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{ mb: 0.5 }}
                      >
                        {user}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {date}
                      </Typography>
                      {canEdit && <Stack direction="row" justifyContent="flex-end" sx={{mt:0.5}}>
                        <Tooltip title="ویرایش گزارش"><IconButton size="small" aria-label={"ویرایش گزارش: "+text} disabled={busy || reportAction.pending}
                          onClick={()=>{reportAction.clearError();updateDialog({kind:"edit",reportId});}} sx={{color:ORANGE}}><EditRoundedIcon fontSize="small"/></IconButton></Tooltip>
                        <Tooltip title="حذف گزارش"><IconButton size="small" aria-label={"حذف گزارش: "+text} disabled={busy || reportAction.pending}
                          onClick={()=>{reportAction.clearError();setConfirmation({kind:"report",reportId});}} sx={{color:ORANGE}}><DeleteOutlineRoundedIcon fontSize="small"/></IconButton></Tooltip>
                      </Stack>}
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Box>

          {/* Sticky footer */}
          <Box
            sx={{
              position: "sticky",
              bottom: 0,
              left: 0,
              right: 0,
              bgcolor: "#FFF",
              display: "flex",
              justifyContent: "center",
              py: 1,
              zIndex: 1,
            }}
          >
            <Button
              variant="contained"
              startIcon={work?.status === "done" ? <RefreshRoundedIcon/> : undefined}
              onClick={handleDoneClick}
              disabled={busy || !work?.canChangeStatus}
              sx={{
                width: 230,
                height: 44,
                gap: 0.75,
                "& .MuiButton-startIcon": { margin: 0 },
                bgcolor: ORANGE,
                borderRadius: 2,
                "&:hover": { bgcolor: "#ff530c" },
              }}
            >
              {work?.status === "done" ? "بازگشت به در حال انجام" : "انجام کار"}
            </Button>
          </Box>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}

/* --------------------- Styled primary button --------------------- */
const CustomButton = styled(Button)({
  borderRadius: "8px",
  fontFamily: "IRANYekanWeb, sans-serif",
  fontSize: "18px",
  padding: "4px 0",
  lineHeight: 1.75,
  minWidth: 0,
  textTransform: "none",
});

export default function WorkPageRoute() {
  const {id}=useParams(),{user}=useAuth();
  return <WorkPage key={user.id+":"+id}/>;
}
