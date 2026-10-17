/********************************************************************
 * CreateProjectPage.jsx
 *
 * A right-to-left (RTL) “Create Project” screen built with React
 * and Material-UI (MUI).  Features:
 *   • Pill-shaped text fields, outline buttons, and a themed switch
 *   • A global 3-second UI lock that simulates an async request
 *   • An inner form (“TabCustom”) that can independently enable/
 *     disable its own controls while respecting the global lock
 *   • All labels and helper text are Persian (Farsi)
 *
 * NOTE: Only comments have been added or rewritten; every executable
 * line is byte-for-byte identical to your original file (except routing hooks).
 ********************************************************************/

// Explain: Import React and needed hooks for state, effects, refs, and memoized callbacks.
import { useState, useEffect, useRef, useCallback } from "react";
// Explain: Import Material UI components used to build the layout and form.
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Switch,
  Stack,
  Backdrop,
  CircularProgress,
} from "@mui/material";
// Explain: Import MUI styled utility to create themed styled components.
import { styled } from "@mui/material/styles";
// Explain: Import React Router hooks to navigate and read route state.
import { useNavigate, useLocation } from "react-router-dom";
// Explain: Import a preconfigured API client to communicate with the backend.
import api from "../lib/api";
import {useAction} from "../hooks/useAction";
import {useAuth} from "../auth/AuthContext";
function readDraft(key) {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key) || "null");
    return draft && typeof draft === "object" && !Array.isArray(draft) ? draft : null;
  } catch {
    return null;
  }
}

// Explain: Section header for shared styled components used throughout the page.
/* ===============================================================
 *  Shared styled components
 * =============================================================== */

// Explain: Create a styled TextField with rounded look and RTL-friendly label behavior.
const CustomTextField = styled(TextField)({
  // Explain: Target the root of the outlined input to adjust radius and background.
  "& .MuiOutlinedInput-root": {
    // Explain: Make the input capsule-shaped.
    borderRadius: "30px",
    // Explain: Light gray background for subtle emphasis.
    backgroundColor: "#f5f5f5",
    // Explain: Remove default outline border.
    "& fieldset": { borderColor: "transparent" },
    // Explain: Keep border invisible on hover as well.
    "&:hover fieldset": { borderColor: "transparent" },
    // Explain: Prevent colored border when focused.
    "&.Mui-focused fieldset": { borderColor: "transparent" },
    // Explain: Style the HTML input element inside.
    "& input": {
      // Explain: Align text to the right for RTL languages.
      textAlign: "right",
      // Explain: Apply the custom font stack to the input text.
      fontFamily: "IRANYekanWeb, sans-serif",
      // Explain: Comfortable inner padding for the input.
      padding: "8px 14px",
    },
  },
  // Explain: Style the floating label for RTL alignment and theme color on focus.
  "& .MuiInputLabel-root": {
    // Explain: Position label from the right side.
    right: "25px",
    // Explain: Disable left positioning for RTL correctness.
    left: "auto",
    // Explain: Set transform origin so animations originate from the right.
    transformOrigin: "right",
    // Explain: Apply the same font to the label text.
    fontFamily: "IRANYekanWeb, sans-serif",
    // Explain: Highlight label with accent color when focused.
    "&.Mui-focused": { color: "#ff7043" },
  },
  // Explain: Adjust the shrunken label transform to look tidy in RTL.
  "& .MuiInputLabel-shrink": {
    // Explain: Fine-tune position/scale of the shrunk label.
    transform: "translate(0, -9px) scale(0.75)",
    // Explain: Keep the transform origin on the right for RTL.
    transformOrigin: "right",
  },
});

// Explain: Create a pill-like contained button with custom font/size and no text transform.
const CustomButton = styled(Button)({
  // Explain: Rounded corners for a friendly look.
  borderRadius: "8px",
  // Explain: Apply the app's preferred font family.
  fontFamily: "IRANYekanWeb, sans-serif",
  // Explain: Slightly larger text for prominence.
  fontSize: "18px",
  // Explain: Vertical padding; width handled by parent.
  padding: "4px 0",
  // Explain: Set line height for better readability.
  lineHeight: 1.75,
  // Explain: Allow the button to shrink to its content width.
  minWidth: 0,
  // Explain: Preserve original casing for button labels.
  textTransform: "none",
});

// Explain: Create an outlined, round button tailored to the accent color.
const CustomOutlineButton = styled(Button)({
  // Explain: Fully rounded button edges.
  borderRadius: "9999px",
  // Explain: Soft accent border by default.
  border: "2px solid rgba(255, 112, 67, 0.4)",
  // Explain: Transparent background until hover.
  backgroundColor: "transparent",
  // Explain: Accent colored text.
  color: "#ff7043",
  // Explain: Use app's custom font.
  fontFamily: "IRANYekanWeb, sans-serif",
  // Explain: Slightly larger font size for emphasis.
  fontSize: "18px",
  // Explain: Vertical padding to enlarge tap area.
  padding: "6px 0",
  // Explain: Comfortable line height.
  lineHeight: 1.75,
  // Explain: Keep original casing.
  textTransform: "none",
  // Explain: Let the button size to its content.
  minWidth: 0,
  // Explain: Hover styles to strengthen the border and add a faint fill.
  "&:hover": {
    backgroundColor: "rgba(255, 112, 67, 0.05)",
    borderColor: "#ff7043",
  },
  // Explain: Dimmed border and text when disabled.
  "&.Mui-disabled": {
    borderColor: "rgba(255, 112, 67, 0.2)",
    color: "rgba(0,0,0,0.26)",
  },
});

// Explain: Customize MUI Switch to use the accent color when checked and rounded track.
const CustomSwitch = styled(Switch)({
  // Explain: Increase padding to improve click/touchability.
  padding: 8,
  // Explain: When the switch is checked, color the thumb and track with accent.
  "& .MuiSwitch-switchBase.Mui-checked": {
    // Explain: Accent-colored thumb.
    color: "#ff7043",
    // Explain: Accent-colored track when checked.
    "& + .MuiSwitch-track": { backgroundColor: "#ff7043" },
  },
  // Explain: Default track style when not checked.
  "& .MuiSwitch-track": { backgroundColor: "#bdbdbd", borderRadius: 9999 },
});

// Explain: Section header for the inner control panel containing the form.
/* ===============================================================
 *  Inner control panel (the actual form fields)
 * =============================================================== */
// Explain: Define the form component handling project creation flow and UI state.
function TabCustom({ isLocked, selectedBreadcrumb, selectedId }) {
  const action=useAction(),auth=useAuth();
  const draftKey="createProjectDraft:"+auth.user.id;
  const initialDraft=useRef(readDraft(draftKey) || {});
  // Explain: Whether the new project should be created under a parent.
  const [isSubProject, setIsSubProject] = useState(initialDraft.current.isSubProject || !!selectedId);
  // Explain: Title input state for the project name.
  const [title, setTitle] = useState(initialDraft.current.title || "");
  // Explain: Human-readable breadcrumb of the selected parent project.
  const [breadcrumb, setBreadcrumb] = useState(selectedBreadcrumb || initialDraft.current.breadcrumb || "");
  // Explain: The selected parent project's id (if any).
  const [selectedParentId, setSelectedParentId] = useState(selectedId || initialDraft.current.selectedParentId || null);

  // Explain: Form completeness checker—only title is required to enable create.
  const isFormComplete = title.trim().length > 0;

  // Explain: A ref to store timer handles for cleanup.
  const timersRef = useRef({});
  // Explain: Router navigator to switch pages programmatically.
  const navigate = useNavigate();

  // Explain: When router-provided breadcrumb changes, sync it to local state.
  useEffect(() => {
    if (selectedBreadcrumb) setBreadcrumb(selectedBreadcrumb);
  }, [selectedBreadcrumb]);

  // Explain: When router-provided id changes, sync the selected parent id.
  useEffect(() => {
    if(selectedId)setSelectedParentId(selectedId);
  }, [selectedId]);

  // Explain: Helper to reset all form fields and clear stored draft.
  const resetForm = () => {
    // Explain: Clear title field.
    setTitle("");
    // Explain: Reset sub-project toggle to false.
    setIsSubProject(false);
    // Explain: Clear breadcrumb display.
    setBreadcrumb("");
    // Explain: Remove selected parent link.
    setSelectedParentId(null);
    // Explain: Delete any persisted draft in sessionStorage.
    initialDraft.current = {};
    try {
      sessionStorage.removeItem(draftKey);
    } catch { /* The form still resets if browser storage is unavailable. */ }
  };

  // Explain: Create a project on the server; root if no parent id is provided.
  const handleCreate = async () => {
    if(!isFormComplete || action.pending || (isSubProject && !selectedParentId))return;
    const result=await action.run(()=>api.post("/projects",{name:title.trim(),parentId:isSubProject ? selectedParentId : null}));
    if(result){resetForm();navigate("/dashboard?projectId="+encodeURIComponent(result.data.id));}
  };
  // Explain: Cancel clears the form and draft, then returns to the dashboard.
  const handleCancel = () => {
    // Explain: Reset to initial empty state.
    resetForm();
    navigate("/dashboard", { replace: true, state: null });
  };

  // Explain: Toggle handler for sub-project switch; clears breadcrumb/parent when turning off.
  const onToggleSubProject = (e) => {
    // Explain: Read new checked state from the switch event.
    const checked = e.target.checked;
    // Explain: Update local state for sub-project mode.
    setIsSubProject(checked);
    // Explain: When disabling sub-project mode, clear parent and breadcrumb.
    if (!checked) {
      setBreadcrumb("");
      setSelectedParentId(null);
    }
  };

  // Explain: Before navigating to the selection page, persist current draft in sessionStorage.
  const handleSelectProject = () => {
    // Explain: Only proceed if sub-project mode is on and UI is not locked.
    if (!isSubProject || isLocked) return;
    // Explain: Save current form state so it can be restored after selection.
    sessionStorage.setItem(
      draftKey,
      JSON.stringify({ title, isSubProject, breadcrumb, selectedParentId })
    );
    // Explain: Navigate to the project tree selection page.
    navigate("/select-project", {
      state: { from: "/create-project", preselectedId: selectedParentId },
    });
  };

  // Explain: Cleanup effect to clear any lingering timers on unmount.
  useEffect(
    () => () => {
      // Explain: Clear the selection timer if it exists.
      clearTimeout(timersRef.current.select);
    },
    []
  );

  // Explain: Render the form UI with inputs, toggles, and action buttons.
  return (
    <Box
      sx={{
        // Explain: Horizontal padding around form content.
        px: 4,
        // Explain: Stack content vertically and center align items.
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // Explain: Add vertical spacing between children except the last.
        "& > *:not(:last-child)": { mb: 3 },
      }}
    >
      {/* Explain: Text input for project title (RTL aligned, required). */}
      {action.error && <Typography color="error" sx={{fontFamily:"IRANYekanWeb",fontSize:13}}>{action.error}</Typography>}
      <CustomTextField
        fullWidth
        variant="outlined"
        label="عنوان پروژه"
        size="small"
        inputProps={{ dir: "rtl" }}
        disabled={isLocked}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />

      {/* Explain: Row with label and switch to mark as sub-project or not. */}
      <Box
        sx={{
          // Explain: Make row fill width and align items nicely.
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Typography
          noWrap
          sx={{
            // Explain: Apply theme font and size to the question label.
            fontFamily: "IRANYekanWeb",
            fontSize: 13,
            color: "#000",
            flexGrow: 1,
            textAlign: "right",
          }}
        >
          آیا این پروژه زیر مجموعه پروژه‌ی دیگری است؟
        </Typography>

        <CustomSwitch checked={isSubProject} onChange={onToggleSubProject} />
      </Box>

      {/* Explain: Button to navigate to project selection when sub-project mode is on. */}
      <CustomOutlineButton
        fullWidth
        disabled={isLocked}
        onClick={handleSelectProject}
      >
        {isSubProject ? "انتخاب پروژه" : "تغییر پروژه"}
      </CustomOutlineButton>

      {/* Explain: Display the currently selected parent breadcrumb (or placeholders). */}
      <Typography
        sx={{
          width: "100%",
          fontFamily: "IRANYekanWeb",
          fontSize: 14,
          color: "#000",
          textAlign: "right",
        }}
      >
        پروژه انتخاب شده:{" "}
        <Typography
          component="span"
          sx={{ color: "#9E9E9E", fontFamily: "IRANYekanWeb" }}
        >
          {isSubProject ? breadcrumb || "__" : "__"}
        </Typography>
      </Typography>

      {/* Explain: Row of actions—cancel and create—aligned RTL and spaced. */}
      <Stack
        direction="row-reverse"
        sx={{ width: "100%", mt: 1, mb: 2, gap: "20px" }}
      >
        {/* Explain: Cancel returns to the dashboard without creating a project. */}
        <CustomButton
          variant="contained"
          disabled={isLocked || action.pending}
          onClick={handleCancel}
          sx={{
            // Explain: Flex sizing to split space evenly in the row.
            flex: "1 1 0",
            // Explain: Neutral gray background to deemphasize the action.
            backgroundColor: "#E0E0E0",
            // Explain: Darker gray text for contrast on the neutral background.
            color: "#757575",
            // Explain: Slightly darker on hover for feedback.
            "&:hover": { backgroundColor: "#d5d5d5" },
            // Explain: Muted colors when disabled.
            "&.Mui-disabled": {
              backgroundColor: "#c2c2c2",
              color: "#9e9e9e",
            },
          }}
        >
          انصراف
        </CustomButton>

        {/* Explain: Create button triggers server-side project creation. */}
        <CustomButton
          variant="contained"
          disabled={isLocked || action.pending || !isFormComplete || (isSubProject && !selectedParentId)}
          onClick={handleCreate}
          sx={{
            // Explain: Flex sizing to share space with the cancel button.
            flex: "1 1 0",
            // Explain: Accent color to emphasize primary action.
            backgroundColor: "#ff7043",
            // Explain: White text for contrast against accent background.
            color: "white",
            // Explain: Darker accent shade on hover for visual feedback.
            "&:hover": { backgroundColor: "#e65100" },
            // Explain: Dimmed accent and white text when disabled.
            "&.Mui-disabled": {
              backgroundColor: "rgba(255, 112, 67, 0.4)",
              color: "#fff",
            },
          }}
        >
          ایجاد
        </CustomButton>
      </Stack>
    </Box>
  );
}

// Explain: Section header for the main page container component.
/* ===============================================================
 *  Main page component
 * =============================================================== */
// Explain: Default export for the page that composes the form and global lock behavior.
export default function CreateProjectPage() {
  // Explain: Global lock state to disable interactions for 3 seconds when triggered.
  const [isLocked, setIsLocked] = useState(false);
  // Explain: Ref to keep the lock timeout id for cleanup and restart.
  const lockTimer = useRef(null);
  // Explain: Access the current location object to read state passed from other routes.
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const draftKey = "createProjectDraft:" + auth.user.id;
  const hasDraft = readDraft(draftKey) !== null;

  // Consume picker state once, and ignore selections belonging to a discarded draft.
  useEffect(() => {
    const selection = location.state;
    if (!selection) return;
    const draft = readDraft(draftKey);
    if (draft && selection.selectedId) {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify({
          ...draft,
          isSubProject: true,
          breadcrumb: selection.selectedPath || "",
          selectedParentId: selection.selectedId,
        }));
      } catch { /* Keep the current selection if draft storage is unavailable. */ }
    }
    navigate(".", { replace: true, state: null });
  }, [location.state, navigate, draftKey]);

  // Explain: Helper to start (or ignore if already active) a 3s UI lock timer.
  const lockUI = useCallback(() => {
    // Explain: Avoid starting a new timer if the UI is already locked.
    if (isLocked) return; // ignore if already active
    // Explain: Enter locked state.
    setIsLocked(true);
    // Explain: Clear any existing timer before starting a new one.
    clearTimeout(lockTimer.current); // reset timer just in case
    // Explain: Unlock after three seconds.
    lockTimer.current = setTimeout(() => setIsLocked(false), 3000);
  }, [isLocked]);

  // Explain: Clear the timer on unmount to prevent state updates on an unmounted component.
  useEffect(() => () => clearTimeout(lockTimer.current), []);

  // Explain: Read breadcrumb path passed from the project selection page (if any).
  const selectedBreadcrumb = hasDraft ? location.state?.selectedPath || "" : "";
  // Explain: Read parent project id passed from the project selection page (if any).
  const selectedIdFromRouter = hasDraft ? location.state?.selectedId || null : null;

  // Explain: Render the page scaffold including a global backdrop and centered card UI.
  /* ----------------------------- UI ----------------------------- */
  return (
    <>
      {/* Explain: Full-screen overlay with spinner to block input while locked. */}
      <Backdrop open={isLocked} sx={{ zIndex: 2000, color: "#fff" }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Explain: Center the paper card on screen and apply RTL direction for content. */}
      <Box
        dir="rtl"
        sx={{
          // Explain: Ensure the wrapper takes at least the full viewport height.
          minHeight: "100vh",
          // Explain: Make the wrapper span the full width.
          width: "100%",
          // Explain: Use flexbox to center the card.
          display: "flex",
          // Explain: Center vertically.
          alignItems: "center",
          // Explain: Center horizontally.
          justifyContent: "center",
          // Explain: Remove default MUI fieldset borders for a cleaner look.
          "& fieldset": { border: "none" }, // remove TF borders
          // Explain: Apply custom font to form labels.
          "& .MuiFormLabel-root": { fontFamily: "IRANYekanWeb" },
        }}
      >
        {/* Explain: Main paper card that contains the page title and the form. */}
        <Paper elevation={3} sx={{ borderRadius: 5, width: 380, px: 0, py: 4 }}>
          {/* Explain: Page title centered at the top of the card. */}
          <Typography
            sx={{
              mb: 4,
              fontFamily: "IRANYekanWeb",
              fontSize: 29,
              color: "#000",
              textAlign: "center",
            }}
          >
            ایجاد پروژه جدید
          </Typography>

          {/* Explain: Insert the inner form panel and pass down the necessary props. */}
          <TabCustom
            isLocked={isLocked}
            lockUI={lockUI}
            selectedBreadcrumb={selectedBreadcrumb}
            selectedId={selectedIdFromRouter} // ← NEW
          />
        </Paper>
      </Box>
    </>
  );
}
