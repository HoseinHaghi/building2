/********************************************************************
 * WorkCreationPage.jsx
 *
 * A right-to-left “Create Work” page implemented with React and MUI.
 * The page provides:
 *   • Pill-shaped inputs (text, select, file upload)
 *   • Project selection via a separate route (overlay click opens /select-project)
 *   • Form submission using useAddWork (multipart/FormData)
 *   • A simple UI lock to prevent repeat actions for 3 seconds after success

 * Notes:
 * - The project dropdown here is a display shell; the actual selection is done
 *  on another page. We mirror the chosen path in a read-only Select pill.
 * - State names prioritize clarity over brevity; styling tokens are centralized
 *  to keep visual consistency.
 ********************************************************************/

// Import React and the hooks used throughout this component.
import { useState, useRef, useEffect } from "react";
// Import Material UI components for layout, inputs, feedback, and actions.
import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  OutlinedInput,
  Chip,
  Stack,
  Button,
  Backdrop,
  CircularProgress,
} from "@mui/material";
// Import MUI styling utilities and theme access.
import { styled, useTheme } from "@mui/material/styles";
// Chevron icon used by the custom Select component.
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/esm/KeyboardArrowDownRounded.js";
// Icon used at the end of the upload button.
import FileUploadOutlinedIcon from "@mui/icons-material/esm/FileUploadOutlined.js";
// Custom mutation hook for posting the new work to the backend.
import {useSaveWork} from "../hooks/useOriginalWorks";
import {useWork} from "../hooks/useWorks";
import {useAuth} from "../auth/AuthContext";
import {errorMessage} from "../lib/api";
import {readSessionDraft,useSessionDraft} from "../hooks/useSessionDraft";
import {useWorkDraftFiles} from "../hooks/useWorkDraftFiles";
// Router hooks for navigation and reading state passed from other pages.
import { useNavigate, useLocation,useParams } from "react-router-dom";

/* ====================== Persist draft key ====================== */
// Session key to persist the form between navigations/tabs (per-tab).
const DRAFT_PREFIX = "createWorkDraft:";

/* ============================================================================ */
/* (constants, styled components, SelectPillLg, FileUploadPill, etc. — unchanged) */
/* ============================================================================ */

// Centralized design tokens: fonts, colors, sizes.
const fontFamily = "IRANYekanWeb";
const highlight = "#ff7043";
const grayBtn = "#EDEDED";
const grayText = "#9E9E9E";
const pillBg = "#EFEFEF";
const selectBg = "#F5F5F5";
const pillHeightLg = 44;
const pillHeightSm = 38;
const pillHeightTall = 50;
const actionBtnHeight = 40;
const fieldWidth = 300;
const fontSize = 13;

// Root container enforcing full-viewport layout and RTL direction.
const Root = styled(Box)({
  position: "fixed",
  inset: 0,
  direction: "rtl",
  overflow: "hidden",
});

// Card container to center content and constrain size.
const Card = styled(Paper)({
  width: 410,
  maxHeight: "94vh",
  borderRadius: 24,
  padding: "8px 36px 40px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
});

// Shared label position when MUI label is in "shrink" state (RTL-friendly).
const shrinkLabelCss = {
  right: 14,
  top: -10,
  transform: "scale(0.75)",
  transformOrigin: "top right",
};

// Base pill-like TextField styling: rounded, filled, RTL text, custom label.
const BaseTF = styled(TextField)({
  width: fieldWidth,
  "& .MuiOutlinedInput-root": {
    borderRadius: 24,
    backgroundColor: pillBg,
    paddingRight: 14,
    "& fieldset": { border: "none" },
    "& input, & textarea": {
      fontFamily,
      fontSize,
      textAlign: "right",
      padding: 0,
      color: "#424242",
      overflowY: "auto",
      resize: "none",
    },
  },
  "& .MuiInputLabel-root": {
    position: "absolute",
    right: 22,
    top: "50%",
    transform: "translate(0,-50%)",
    fontSize,
    fontFamily,
    color: "#9E9E9E",
    pointerEvents: "none",
    "&.Mui-focused": { color: highlight },
    "&.MuiInputLabel-shrink": shrinkLabelCss,
  },
});

// Height variants for the pill TextField.
const PillTextFieldLg = styled(BaseTF)({
  "& .MuiOutlinedInput-root": { minHeight: pillHeightLg },
});
const PillTextFieldSm = styled(BaseTF)({
  "& .MuiOutlinedInput-root": { minHeight: pillHeightSm },
});
const PillTextFieldTall = styled(BaseTF)({
  "& .MuiOutlinedInput-root": { minHeight: pillHeightTall },
});

// Menu sizing constants for the Select dropdown.
const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
// MenuProps passed to MUI Select to constrain the list size.
const MenuProps = {
  PaperProps: {
    style: { maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP, width: 250 },
  },
};

// Reusable large pill Select component with optional control/uncontrol behavior.
function SelectPillLg({
  label, // Floating label text
  items, // Array of string options
  value, // Controlled value (if provided)
  onChange, // Controlled change handler (if provided)
  required = false, // Required flag for a11y and visuals
  disabled = false, // Disabled state to prevent interaction
  sx, // Optional style overrides for the Select root
  ...rest // Spread anything else to the FormControl
}) {
  // Access the theme to use typography weights for selected items.
  const theme = useTheme();
  // Internal state used when value/onChange are not provided.
  const [inner, setInner] = useState("");
  // Use controlled value if present, otherwise fall back to internal state.
  const val = value !== undefined ? value : inner;
  // Choose external onChange or internal setter.
  const handle = onChange || ((e) => setInner(e.target.value));

  // Render a FormControl with floating label and customized Select.
  return (
    <FormControl
      disabled={disabled}
      required={required}
      sx={{
        width: fieldWidth,
        backgroundColor: selectBg,
        borderRadius: "40px",
        direction: "rtl",
        "& fieldset": { border: "none" },
        "& .MuiOutlinedInput-root": {
          paddingRight: 0,
          borderRadius: "40px",
        },
      }}
      {...rest}
    >
      {/* Floating label with RTL positioning and highlight on focus */}
      <InputLabel
        required={required}
        sx={{
          color: "#9E9E9E",
          right: 22,
          top: "50%",
          transform: "translate(0,-50%)",
          fontSize,
          fontFamily,
          "&.Mui-focused": { color: highlight },
          "&.MuiInputLabel-shrink": shrinkLabelCss,
        }}
      >
        {label}
      </InputLabel>

      {/* Select configured for RTL with a custom chevron icon and chip-like value */}
      <Select
        SelectDisplayProps={{"aria-label":label}}
        disabled={disabled}
        value={val}
        onChange={handle}
        input={<OutlinedInput label={label} />}
        IconComponent={KeyboardArrowDownRoundedIcon}
        MenuProps={MenuProps}
        sx={{
          minHeight: pillHeightLg,
          borderRadius: "40px",
          ".MuiSelect-select": {
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            paddingTop: "10px",
            paddingBottom: "10px",
            paddingLeft: "36px", // Space for chevron (left side in RTL)
            paddingRight: "0px",
            fontFamily,
            fontSize,
            minWidth: 0,
            overflow: "hidden",
          },
          ".MuiSelect-icon": {
            left: 12, // Place chevron on the left in RTL
            right: "auto",
            fontSize: 20,
            color: "#9E9E9E",
          },
          ...sx, // Allow caller to override styles
        }}
        renderValue={(selected) =>
          // If a value exists, show it inside an orange chip; otherwise leave empty.
          selected ? (
            <Box
              sx={{
                display: "flex",
                gap: 0.5,
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <Chip
                label={selected}
                sx={{
                  backgroundColor: "#FF4500",
                  color: "#fff",
                  fontFamily,
                  maxWidth: "100%",
                  ".MuiChip-label": {
                    display: "block",
                    maxWidth: "100%",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  },
                }}
              />
            </Box>
          ) : (
            ""
          )
        }
      >
        {/* Render menu items; bold the currently selected one using theme weights */}
        {items.map((name) => (
          <MenuItem
            key={name}
            value={name}
            sx={{
              fontFamily,
              fontWeight:
                val === name
                  ? theme.typography.fontWeightMedium
                  : theme.typography.fontWeightRegular,
            }}
          >
            {name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

// Styled button acting as a pill-shaped file input trigger.
const UploadPillStyled = styled(Button)({
  width: fieldWidth,
  height: pillHeightLg,
  minHeight: pillHeightLg,
  borderRadius: 24,
  backgroundColor: selectBg,
  paddingRight: 14,
  paddingLeft: 10,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  justifyContent: "space-between",
  textTransform: "none",
  fontFamily,
  fontSize,
  color: "#9E9E9E",
  "&:hover": { backgroundColor: "#E0E0E0" },
  "& .MuiButton-endIcon": { marginLeft: 2, flexShrink: 0 },
});

// Truncated filename span (RTL) that ellipsizes long names.
const FileNameSpan = styled("span")({
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  direction: "rtl",
});

// File upload pill component; forwards the selected File to parent via onFile.
const FileUploadPill = ({ label, onFile, file, disabled }) => {
  const fileName = file?.name || "";
  // Ref to reset the native input so the same file can be re-picked.
  const inputRef = useRef(null);

  return (
    <UploadPillStyled
      component="label"
      disabled={disabled}
      title={label === "تصویر شاخص کار" ? "PNG، JPEG یا WebP؛ حداکثر ۱۰ مگابایت" : "حداکثر ۱۰ مگابایت"}
      endIcon={<FileUploadOutlinedIcon sx={{ color: "#9E9E9E" }} />}
    >
      {/* Show chosen file name, fallback to label */}
      <FileNameSpan title={fileName || label}>{fileName || label}</FileNameSpan>
      {/* Hidden native file input bound to the styled button via "label" */}
      <input
        ref={inputRef}
        hidden
        type="file"
        disabled={disabled}
        accept={label === "تصویر شاخص کار" ? ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" : undefined}
        aria-label={label}
        onChange={(e) => {
          // Safely read the first selected file (or null).
          const file = e.target.files?.[0] || null;
          // Update visual filename.
          // Notify parent about the selected file.
          onFile?.(file);
          // Reset the input value so the same file selection can re-trigger onChange.
          if (inputRef.current) inputRef.current.value = null;
        }}
      />
    </UploadPillStyled>
  );
};

// Base button style used by both primary (Create) and secondary (Cancel) buttons.
const BtnBase = styled(Button)({
  height: actionBtnHeight,
  minWidth: 140,
  borderRadius: 6,
  fontFamily,
  fontSize: 16,
  fontWeight: 500,
});
// Primary action button (accent background).
const CreateBtn = styled(BtnBase)({
  backgroundColor: highlight,
  color: "#FFFFFF",
  "&:hover": { backgroundColor: "#ff5d19" },
});
// Secondary action button (neutral background).
const CancelBtn = styled(BtnBase)({
  backgroundColor: grayBtn,
  color: grayText,
  "&:hover": { backgroundColor: "#E0E0E8" },
});

// Wrapper choosing the correct TextField pill variant by "size" prop.
const TextFieldPill = ({ label, multiline = false, size = "lg", ...props }) => {
  // Select variant component based on "size".
  const Comp =
    size === "tall"
      ? PillTextFieldTall
      : size === "sm"
      ? PillTextFieldSm
      : PillTextFieldLg;
  // Render with consistent multiline rows calculation.
  return (
    <Comp
      label={label}
      fullWidth
      multiline={multiline}
      rows={multiline ? (size === "tall" ? 3 : 2) : undefined}
      {...props}
    />
  );
};

// Static options for the floor dropdown (Persian labels).
const floors = [
  "طبقه اول",
  "طبقه دوم",
  "طبقه سوم",
  "طبقه چهارم",
  "طبقه پنجم",
  "طبقه ششم",
  "طبقه هفتم",
];

/* ============================== Main ============================== */
// Main page component managing form state, persistence, navigation and submit.
export default function WorkCreationPage() {
  const {id}=useParams(),{user}=useAuth();
  return <WorkForm key={user.id+":"+(id || "new")} id={id}/>;
}

function WorkForm({id}) {
  const auth=useAuth(),initialWork=useWork(id),initialized=useRef(false),submitted=useRef(false);
  const navigate=useNavigate(),location=useLocation();
  const DRAFT_KEY=(id ? "editWorkDraft:"+id+":" : DRAFT_PREFIX)+auth.user.id;
  const fresh=!!location.state?.startNewWork;
  const hadSavedDraft=useRef(!!readSessionDraft(DRAFT_KEY));
  const [draft,updateDraft,removeDraft]=useSessionDraft(DRAFT_KEY,{
    title:"",project:fresh ? location.state.selectedPath || "" : "",floor:"",summary:"",prereq:"",
    selectedProjectId:fresh ? location.state.selectedId || null : null,
    selectedProjectPath:fresh ? location.state.selectedPath || "" : "",
  },fresh);
  const {title,project,floor,summary,prereq,selectedProjectId,selectedProjectPath}=draft;
  const setTitle=title=>updateDraft({title});
  const setProject=project=>updateDraft({project});
  const setFloor=floor=>updateDraft({floor});
  const setSummary=summary=>updateDraft({summary});
  const setPrereq=prereq=>updateDraft({prereq});
  const setSelectedProjectId=selectedProjectId=>updateDraft({selectedProjectId});
  const setSelectedProjectPath=selectedProjectPath=>updateDraft({selectedProjectPath});
  const fileDraft=useWorkDraftFiles(DRAFT_KEY,fresh || !hadSavedDraft.current);
  const {cover,attachment}=fileDraft.files;
  const setFile=(kind,file)=>fileDraft.select(kind,file);
  const [uploadsKey,setUploadsKey]=useState(0);
  useEffect(()=>{
    if(!id || !initialWork.data || initialized.current)return;
    initialized.current=true;
    if(hadSavedDraft.current)return;
    const work=initialWork.data;
    updateDraft({title:work.title,project:work.project,floor:floors[work.floorNum-1],
      summary:work.summary,prereq:work.prerequisite,
      selectedProjectId:work.projectId,selectedProjectPath:work.project});
  },[id,initialWork.data,updateDraft]);
  useEffect(()=>{
    if(id)return;
    const state=location.state;
    if(state && (state.startNewWork || state.selectedId || state.selectedPath)) {
      updateDraft({project:state.selectedPath || "",selectedProjectId:state.selectedId || null,
        selectedProjectPath:state.selectedPath || ""});
      navigate(".",{replace:true,state:{}});
    }
  },[id,location.state,navigate,updateDraft]);
  const {mutate:addWork,isPending}=useSaveWork(id);
  const persistDraft=()=>updateDraft({});
  const clearDraft=async()=>{
    removeDraft();
    await fileDraft.clear();
  };

  /* ---------- SUBMIT ---------- */
  // Submit handler that validates completion and posts FormData
  const handleCreate = () => {
    if (submitted.current || !isFormComplete || isPending || fileDraft.loading || fileDraft.saving) return;

    const floorNumber = (() => {
      const m = String(floor).match(/\d+/);
      if (m) return parseInt(m[0], 10) || 0;

      const map = {
        اول: 1,
        دوم: 2,
        سوم: 3,
        چهارم: 4,
        پنجم: 5,
        ششم: 6,
        هفتم: 7,
      };
      for (const k in map) if (String(floor).includes(k)) return map[k];
      return 0;
    })();

    const fd = new FormData();
    fd.append("title", title);
    fd.append("project", project);
    fd.append("projectId", selectedProjectId || "");
    fd.append("floor", floor);
    fd.append("floorNum", String(floorNumber));
    fd.append("summary", summary);
    fd.append("prerequisite", prereq);
    fd.append("status", "in_progress");
    if (cover) fd.append("cover", cover);
    if (attachment) fd.append("attachment", attachment);

    addWork(fd, {
      onSuccess: async createdWork => {
        submitted.current=true;
        await clearDraft();
        navigate("/works/"+encodeURIComponent(id || createdWork.id));
      },
      onError: error=>window.alert(errorMessage(error)),
    });
  };

  /* ---------- RESET ---------- */
  const resetForm = async () => {
    // Clear all inputs and local selection.
    setTitle("");
    setProject("");
    setFloor("");
    setSummary("");
    setPrereq("");
    // Clear files and re-mount upload pills to clear their visible labels.
    setSelectedProjectId(null);
    setSelectedProjectPath("");
    setUploadsKey((k) => k + 1);
    // Remove any persisted draft from sessionStorage.
    await clearDraft();
  };

  const handleCancel = async () => {
    if(isPending || fileDraft.loading || fileDraft.saving)return;
    if(id){await clearDraft();navigate("/works/"+encodeURIComponent(id));return;}
    const destination=selectedProjectId ? "/dashboard?projectId="+encodeURIComponent(selectedProjectId) : "/dashboard";
    await resetForm();navigate(destination, { replace: true, state: null });
  };

  /* ---------- LIGHTWEIGHT LOCK ---------- */
  /* ---------- COMPLETENESS ---------- */
  // Minimal completeness check: all required text fields must be non-empty.
  const isFormComplete = [title, project, floor, summary].every((v) =>
    typeof v === "string" ? v.trim().length > 0 : !!v
  );

  /* ---------------------------- UI ---------------------------- */
  return (
    // Fixed root; everything inside renders above a possible Backdrop.
    <Root>
      {/* Global loading/lock overlay shown while isLocked is true */}
      <Backdrop open={isPending || fileDraft.loading || fileDraft.saving || (!!id && initialWork.isLoading)} sx={{ zIndex: 2000, color: "#fff" }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Center the card in the viewport using absolute transform */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <Card elevation={3}>
          {/* Page title */}
          <Typography
            sx={{
              fontFamily,
              fontSize: 24,
              fontWeight: 400,
              textAlign: "center",
              mb: 0.5,
            }}
          >
            {id ? "ویرایش کار" : "ایجاد کار جدید"}
          </Typography>

          {/* Form stack with narrow spacing; aligned center */}
          <Stack spacing={0.6} alignItems="center">
            {/* Title input (required) */}
            <TextFieldPill
              label="عنوان کار"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            {/* Project selector (display-only). We persist draft BEFORE navigating away. */}
            <Box sx={{ position: "relative", width: "100%" }}>
              {/* Read-only Select showing the selected project path */}
              <SelectPillLg
                label="انتخاب پروژه"
                items={selectedProjectPath ? [selectedProjectPath] : []}
                value={selectedProjectPath || ""}
                onChange={() => {}}
                required
                sx={{
                  "& .MuiSelect-select, & .MuiInputBase-input": {
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textAlign: "right",
                    direction: "rtl",
                    display: "block",
                    paddingLeft: "34px", // Reserve space for chevron on the left (RTL)
                  },
                  "& .MuiSelect-icon": { left: 8, right: "auto" },
                }}
              />
              {/* Transparent overlay captures click: save draft and navigate to selection page */}
              <Box
                role="button"
                tabIndex={id ? -1 : 0}
                aria-label="انتخاب پروژه"
                onKeyDown={e=>{if(!id && (e.key==="Enter" || e.key===" ")){e.preventDefault();persistDraft();navigate("/select-project",{state:{from:"/create-work",preselectedId:selectedProjectId}});}}}
                onClick={() => {
                  if(id)return;
                  // Persist the current form before leaving this route.
                  persistDraft();
                  // Navigate to the project picker and pass current selection as a hint.
                  navigate("/select-project", {
                    state: {
                      from: "/create-work",
                      preselectedId: selectedProjectId,
                    },
                  });
                }}
                sx={{
                  position: "absolute",
                  inset: 0,
                  cursor: "pointer",
                  borderRadius: "999px",
                }}
              />
            </Box>

            {/* Floor selection (required) */}
            <SelectPillLg
              label="انتخاب طبقه"
              items={floors}
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              required
            />

            {/* Short summary (multiline) */}
            <TextFieldPill
              label="شرح مختصر کار"
              multiline
              size="tall"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
            />

            {/* Prerequisites (multiline) */}
            <TextFieldPill
              label="شرح پیش نیاز"
              multiline
              size="tall"
              value={prereq}
              onChange={(e) => setPrereq(e.target.value)}
            />

            {/* File uploads (keys ensure visual reset on form reset) */}
            <FileUploadPill
              key={`cover-${uploadsKey}`}
              label="تصویر شاخص کار"
              file={cover}
              disabled={isPending || fileDraft.loading || fileDraft.saving}
              onFile={file=>setFile("cover",file)}
            />
            <FileUploadPill
              key={`att-${uploadsKey}`}
              label="فایل پیوست"
              file={attachment}
              disabled={isPending || fileDraft.loading || fileDraft.saving}
              onFile={file=>setFile("attachment",file)}
            />
            <Typography sx={{fontFamily,fontSize:10,color:"#757575",lineHeight:1.4}}>حداکثر هر فایل ۱۰ مگابایت؛ تصویر: PNG، JPEG یا WebP.</Typography>
            {fileDraft.error && <Typography role="alert" color="error" sx={{fontFamily,fontSize:12,maxHeight:48,overflowY:"auto"}}>{fileDraft.error}</Typography>}
          </Stack>

          {/* Action buttons row: Create (primary) and Cancel (secondary) */}
          <Stack
            direction="row"
            sx={{
              mt: 1,
              width: fieldWidth,
              justifyContent: "center",
              gap: "10px",
            }}
          >
            {/* Create triggers submit; disabled while pending or incomplete */}
            <CreateBtn
              onClick={handleCreate}
              disabled={isPending || fileDraft.loading || fileDraft.saving || !isFormComplete}
              sx={{
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
              {id ? "ذخیره" : "ایجاد"}
            </CreateBtn>

            {/* Cancel clears the draft and returns to the selected project's dashboard. */}
            <CancelBtn
              onClick={handleCancel}
              disabled={isPending || fileDraft.loading || fileDraft.saving}
              sx={{
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
            </CancelBtn>
          </Stack>
        </Card>
      </Box>
    </Root>
  );
}
