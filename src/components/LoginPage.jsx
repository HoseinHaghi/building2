/********************************************************************
 * LoginPage.jsx
 *
 * A right‑to‑left (RTL) login / sign‑up form built with React and
 * Material‑UI (MUI).  It supports two tabs (Login, Sign‑Up), basic
 * client‑side validation, an error snackbar, and a 3‑second UI lock
 * to throttle repeated submissions.
 *******************************************************************/

import { useState, useRef, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Backdrop,
  CircularProgress,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/esm/CloseRounded.js";
import {Navigate,useLocation} from "react-router-dom";
import {useAuth} from "../auth/AuthContext";
import {errorMessage} from "../lib/api";

/* ====================== Shared constants ====================== */
const fontFamily = "IRANYekanWeb, sans-serif"; // Consistent RTL font
const highlight = "#ff7043"; // Primary accent color

/* ======================= Styled components ==================== */

/* ---------- Re‑usable text field with rounded look ------------ */
const CustomTextField = styled(TextField)({
  "& .MuiOutlinedInput-root": {
    height: 44,
    borderRadius: 28,
    backgroundColor: "#f5f5f5",
    "& fieldset": { borderColor: "transparent" },
    "&:hover fieldset": { borderColor: "transparent" },
    "&.Mui-focused fieldset": { borderColor: "transparent" },
    "& input": {
      textAlign: "right",
      fontFamily,
      padding: "10px 14px",
      fontSize: 15,
    },
  },
  "& .MuiInputLabel-root": {
    right: 22,
    left: "auto",
    fontSize: 14,
    transformOrigin: "right",
    fontFamily,
    "&.Mui-focused": { color: highlight },
  },
  "& .MuiInputLabel-shrink": {
    transform: "translate(0, -7px) scale(0.75)",
    transformOrigin: "right",
  },
});

/* --------------- Primary (orange) action button --------------- */
const PrimaryButton = styled(Button)({
  borderRadius: 8,
  fontFamily,
  fontSize: 17,
  padding: "8px 0",
  minWidth: 0,
  textTransform: "none",
  backgroundColor: highlight,
  color: "#fff",
  "&:hover": { backgroundColor: "#e65100" },
  "&.Mui-disabled": {
    backgroundColor: "rgba(0,0,0,0.26)",
    color: "#fff",
  },
});

/* ------------ Container that visually groups tabs ------------- */
const TabContainer = styled(Box)({
  display: "flex",
  width: "100%",
  borderRadius: 9999,
  backgroundColor: "#f5f5f5",
  overflow: "hidden",
});

/* -------------- Individual tab button (Login / Sign‑Up) -------- */
const TabButton = styled(({ active, ...other }) => {void active;return <Button {...other}/>;})(
  ({ active }) => ({
    flex: 1,
    borderRadius: 9999,
    fontFamily,
    fontSize: 17,
    textTransform: "none",
    color: active ? "#fff" : "#555",
    backgroundColor: active ? highlight : "transparent",
    "&:hover": {
      backgroundColor: active ? highlight : "rgba(0,0,0,0.04)",
    },
    transition: "all .2s",
    height: 44,
    padding: 0,
  })
);

/* ==================== Error snackbar replica =================== */
function ErrorBar({ message, onClose }) {
  return (
    <Box
      sx={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 94,
        height: 48,
        display: "flex",
        direction: "ltr",
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: 3,
        zIndex: 5,
        mx: 3.5,
      }}
    >
      {/* Close (X) side */}
      <Box
        onClick={onClose}
        sx={{
          width: 52,
          bgcolor: "#b71c1c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "background-color .2s",
          "&:hover": { bgcolor: "#8B0000" },
        }}
      >
        <CloseRoundedIcon sx={{ fontSize: 26, color: "#fff" }} />
      </Box>

      {/* Message area */}
      <Box
        dir="rtl"
        sx={{
          flex: 1,
          bgcolor: "#e53935",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily,
          fontSize: 14,
          color: "#fff",
        }}
      >
        {message}
      </Box>
    </Box>
  );
}

/* ======================== Main component ======================= */
export default function LoginPage() {
  const auth=useAuth(),location=useLocation();
  const destination=location.state?.from || "/dashboard";
  const safeDestination=destination.startsWith("/") && !destination.startsWith("//") && !destination.startsWith("/login") ? destination : "/dashboard";
  const [tab, setTab] = useState("login"); // "login" | "signup"

  /* ---------- 3‑second lock to throttle clicks ---------- */
  const [isLocked, setIsLocked] = useState(false);
  const lockTimer = useRef(null);
  useEffect(
    () => () => clearTimeout(lockTimer.current), // Clear on unmount
    []
  );

  /* -------- Error bar with automatic 3‑second hide -------- */
  const [errorMsg, setErrorMsg] = useState("");
  const errTimer = useRef(null);
  useEffect(() => {
    if (errorMsg) {
      clearTimeout(errTimer.current);
      errTimer.current = setTimeout(() => setErrorMsg(""), 3000);
    }
    return () => clearTimeout(errTimer.current);
  }, [errorMsg]);

  /* ---------------- Form state (separate per tab) ---------------- */
  // Login fields
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  // Sign‑Up fields
  const [suFirstName, setSuFirstName] = useState("");
  const [suLastName, setSuLastName] = useState("");
  const [suUsername, setSuUsername] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suRepeat, setSuRepeat] = useState("");

  /* Reset any error whenever the active tab changes */
  useEffect(() => setErrorMsg(""), [tab]);

  /* ---------------------- Event handlers ------------------------ */
  const handleLogin = async () => {
    if(isLocked)return;
    setErrorMsg("");setIsLocked(true);
    try {await auth.login({identifier:loginUsername,password:loginPassword});}
    catch(error){setErrorMsg(errorMessage(error));}
    finally {setIsLocked(false);}
  };
  const handleSignup = async () => {
    if(isLocked)return;
    if(suPassword!==suRepeat){setErrorMsg("تکرار رمز عبور اشتباه می‌باشد.");return;}
    if(!suFirstName.trim() || !suLastName.trim()){setErrorMsg("نام و نام خانوادگی را وارد کنید.");return;}
    setErrorMsg("");setIsLocked(true);
    try {await auth.register({name:suFirstName.trim()+" "+suLastName.trim(),username:suUsername.trim(),password:suPassword});}
    catch(error){setErrorMsg(errorMessage(error));}
    finally {setIsLocked(false);}
  };

  const isSignup = tab === "signup";
  const fieldSpacing = isSignup ? 2 : 2.2; // Tighter form in sign‑up

  if(auth.user)return <Navigate to={tab === "signup" ? "/dashboard" : safeDestination} replace/>;
  /* ========================== Render ============================ */
  return (
    <>
      {/* Dim the screen while locked */}
      <Backdrop open={isLocked} sx={{ zIndex: 2000, color: "#fff" }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Centered card container */}
      <Box
        dir="rtl"
        sx={{
          width: "100%",
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Paper
          elevation={3}
          sx={{
            width: 320,
            borderRadius: 3,
            py: 3.5,
            px: 3.5,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
            overflow: "visible",
          }}
        >
          {/* -------- Heading -------- */}
          <Typography
            sx={{
              fontFamily,
              fontSize: 26,
              color: "#000",
              textAlign: "center",
              mb: 3.5,
              lineHeight: 1.4,
            }}
          >
            به ساختمان خوش آمدید!
          </Typography>

          {/* -------- Tab switcher -------- */}
          <TabContainer sx={{ mb: 3.5 }}>
            <TabButton
              active={tab === "login"}
              disableRipple
              onClick={() => setTab("login")}
            >
              ورود
            </TabButton>
            <TabButton
              active={tab === "signup"}
              disableRipple
              onClick={() => setTab("signup")}
            >
              ثبت نام
            </TabButton>
          </TabContainer>

          {/* -------- Helper text -------- */}
          <Typography
            sx={{
              fontFamily,
              fontSize: 13.5,
              color: "#000",
              mb: 2.5,
            }}
          >
            لطفا اطلاعات زیر را پر کنید.
          </Typography>

          {/* ======================== Forms ======================== */}
          {tab === "login" ? (
            /* ---------------- Login form ---------------- */
            <Box key="login" sx={{ width: "100%" }}>
              <Stack spacing={fieldSpacing} sx={{ mb: 3 }}>
                <CustomTextField
                  fullWidth
                  variant="outlined"
                  label="نام کاربری"
                  size="small"
                  inputProps={{ dir: "rtl" }}
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                />
                <CustomTextField
                  fullWidth
                  variant="outlined"
                  label="رمز عبور"
                  size="small"
                  type="password"
                  inputProps={{ dir: "rtl" }}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </Stack>

              <PrimaryButton
                fullWidth
                disabled={isLocked}
                onClick={handleLogin}
              >
                وارد شوید
              </PrimaryButton>
            </Box>
          ) : (
            /* --------------- Sign‑Up form ---------------- */
            <Box key="signup" sx={{ width: "100%" }}>
              <Stack spacing={fieldSpacing} sx={{ mb: 3 }}>
                <CustomTextField
                  fullWidth
                  variant="outlined"
                  label="نام"
                  size="small"
                  inputProps={{ dir: "rtl" }}
                  value={suFirstName}
                  onChange={(e) => setSuFirstName(e.target.value)}
                />
                <CustomTextField
                  fullWidth
                  variant="outlined"
                  label="نام خانوادگی"
                  size="small"
                  inputProps={{ dir: "rtl" }}
                  value={suLastName}
                  onChange={(e) => setSuLastName(e.target.value)}
                />
                <CustomTextField
                  fullWidth
                  variant="outlined"
                  label="نام کاربری"
                  size="small"
                  inputProps={{ dir: "rtl" }}
                  value={suUsername}
                  onChange={(e) => setSuUsername(e.target.value)}
                />
                <CustomTextField
                  fullWidth
                  variant="outlined"
                  label="رمز عبور"
                  size="small"
                  type="password"
                  inputProps={{ dir: "rtl" }}
                  value={suPassword}
                  onChange={(e) => setSuPassword(e.target.value)}
                />
                <CustomTextField
                  fullWidth
                  variant="outlined"
                  label="تکرار رمز عبور"
                  size="small"
                  type="password"
                  inputProps={{ dir: "rtl" }}
                  value={suRepeat}
                  onChange={(e) => setSuRepeat(e.target.value)}
                />
              </Stack>

              <PrimaryButton
                fullWidth
                disabled={isLocked}
                onClick={handleSignup}
              >
                ثبت نام
              </PrimaryButton>
            </Box>
          )}

          {/* ---------- Error snackbar (shared) ---------- */}
          {errorMsg && (
            <ErrorBar message={errorMsg} onClose={() => setErrorMsg("")} />
          )}
        </Paper>
      </Box>
    </>
  );
}
