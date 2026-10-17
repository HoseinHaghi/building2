/********************************************************************
 * UserProfile.jsx
 *
 * Main RTL dashboard consisting of:
 *   • Collapsible sidebar tree (user tasks + nested projects)
 *   • Two central work areas selected via tree:
 *       – TasksPage ........ two expandable lists of TaskCards
 *       – BoardPreview ..... floor‑by‑floor bubble board
 *   • Bubble click opens a dialog; bubbles can be “deleted”
 *   • Global 3‑second locks on several actions to mimic API delay
 *
 * Important: ‑‑‑ Only comments were added or rewritten. Every line of
 * executable code, every literal, and the original ordering remain
 * 100 % identical to your source.
 ********************************************************************/
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  Fragment,
} from "react";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  CssBaseline,
  GlobalStyles,
  Avatar,
  Link,
  Button,
  Backdrop,
  CircularProgress,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
} from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/esm/MenuRounded.js";
import CloseRoundedIcon from "@mui/icons-material/esm/CloseRounded.js";
import PersonRoundedIcon from "@mui/icons-material/esm/PersonRounded.js";
import AssignmentRoundedIcon from "@mui/icons-material/esm/AssignmentRounded.js";
import ExpandMoreRoundedIcon from "@mui/icons-material/esm/ExpandMoreRounded.js";
import ExpandLessRoundedIcon from "@mui/icons-material/esm/ExpandLessRounded.js";
import DeleteOutlineRoundedIcon from "@mui/icons-material/esm/DeleteOutlineRounded.js";
import EditRoundedIcon from "@mui/icons-material/esm/EditRounded.js";
import AddRoundedIcon from "@mui/icons-material/esm/AddRounded.js";
import PlaylistAddRoundedIcon from "@mui/icons-material/esm/PlaylistAddRounded.js";
import { useNavigate,useSearchParams } from "react-router-dom";
import { useProjectTree } from "../hooks/useProjectTree";
import {useOriginalWorks as useWorks} from "../hooks/useOriginalWorks";
import {useAction} from "../hooks/useAction";
import {useAuth} from "../auth/AuthContext";
import api,{fileUrl} from "../lib/api";
import {ConfirmDialog,TextDialog,QueryFeedback} from "./shared";
import MoreHorizRoundedIcon from "@mui/icons-material/esm/MoreHorizRounded.js";
import LogoutRoundedIcon from "@mui/icons-material/esm/LogoutRounded.js";

/* ========== Layout constants ========== */
const CLOSED_WIDTH = 64; // sidebar collapsed width
const OPEN_WIDTH = 240; // sidebar expanded width
const MARGIN = 16; // margin around card & sidebar
const TRANSITION = "width 0.25s ease"; // sidebar open/close animation

/* ========== Board geometry (pixels) ========== */
const CIRCLE_SIZE = 48;
const GAP = 16; // gap between bubbles
const COL_GAP = 5; // gap between right/left columns
const LABEL_COL_W = 240; // width of row‑label column
const MORE_BOX_EST = 110; // rough width of “+x more” box

const SidebarAction = ({ expanded, label, Icon, onClick, disabled = false, description }) => (
  <Tooltip title={description || (expanded ? "" : label)} placement="left" arrow describeChild>
    <Box component="span" sx={{ display: "inline-flex", width: expanded ? "100%" : 40 }}>
      <Button
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        sx={{
          width: "100%", minWidth: 40, height: 40, px: expanded ? 2 : 0,
          borderRadius: "999px", bgcolor: "rgba(255,112,67,0.15)", color: "#ff7043",
          fontFamily: "IRANYekanWeb", fontSize: 14, fontWeight: 500,
          textTransform: "none", whiteSpace: "nowrap", gap: 1,
          "&:hover": { bgcolor: "rgba(255,112,67,0.25)" },
          "&.Mui-focusVisible": { outline: "2px solid #ff7043", outlineOffset: 2 },
        }}
      >
        <Icon sx={{ fontSize: 22, flexShrink: 0 }} />
        {expanded && label}
      </Button>
    </Box>
  </Tooltip>
);

const findProjectById = (nodes, projectId) => {
  if (!projectId) return null;
  for (const node of nodes) {
    if (node.id === projectId) return node;
    const found = findProjectById(node.children || [], projectId);
    if (found) return found;
  }
  return null;
};

/* ========== General helpers ========== */
const toFa = (s) => String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]); // 0‑9 → Persian

// کمک: اگر طبقه فارسیِ آماده بود همون را نشان بده، وگرنه "طبقهٔ X"
const formatFloor = (f) => {
  if (f == null || f === "") return "";
  const s = String(f);
  return /طبقه/.test(s) ? s : `طبقهٔ ${toFa(s)}`;
};

// مسیر پروژه‌ای که به‌صورت "ریشه > ... > برگ" یا "ریشه < ... < برگ" آمده را خرد می‌کند
const splitProjectPath = (p) => {
  const s = String(p || "").trim();
  if (!s) return [];
  // پشتیبانی از > ، < ، / ، \ و نشانه‌های جهتی یونی‌کد
  return s
    .split(/[><\\/›«»]+/u)
    .map((x) => x.trim())
    .filter(Boolean);
};

// از مسیر، نام ریشه و برگ را برمی‌گرداند
const getProjectRootAndLeaf = (p) => {
  const parts = splitProjectPath(p);
  return { root: parts[0] || "", leaf: parts[parts.length - 1] || "" };
};

// تبدیل رکورد work (از سرور) به شکل موردنیاز TaskCard
// تبدیل رکورد work (از سرور) به شکل موردنیاز TaskCard
const workToTaskItem = (w) => {
  // بعضی ردیف‌ها ممکن است علاوه بر project، فیلدهای دیگری هم داشته باشند
  const projectPath = w.projectPath || w.selectedProjectPath || w.project || "";

  const { root, leaf } = getProjectRootAndLeaf(projectPath);

  // اگر floorNum بود همان را نمایش می‌دهیم؛ وگرنه از floor متنی استفاده می‌کنیم
  const floorValue = w.floorNum ?? w.floor;
  const floorPart = formatFloor(floorValue); // خروجی مثل "طبقهٔ ۵" یا "طبقه ششم"

  const buildingPart = root ? `در ساختمان ${root}` : "";
  let location = [floorPart, buildingPart].filter(Boolean).join(" ");
  if (leaf) location += ` / ${leaf}`;

  return {
    id: w.id,
    cover: w.cover,
    title: w.title || "بدون عنوان",
    location: location || "—",
  };
};

/* ========== Static board data ========== */
const initialBoardRows = [
  { id: 7, label: "طرح مسئله", bubbles: 4, more: 12 },
  { id: 6, label: "مدیریت", bubbles: 4, more: 10 },
  { id: 5, label: "مسئله علمی", bubbles: 8, more: 5 },
  { id: 4, label: "خلاقیت", bubbles: 4, more: 3 },
  { id: 3, label: "توسعه‌دهنده", bubbles: 6, more: 4 },
  { id: 2, label: "کارآموز", bubbles: 4, more: 5 },
  { id: 1, label: "تولید محتوا", bubbles: 1, more: 0 },
];

/* ======= Style helpers used by Pill ======= */
const levelBg = (lvl, sel) =>
  sel
    ? "#ff7043"
    : lvl === 0
    ? "rgba(255,112,67,0.15)"
    : lvl === 1
    ? "#F5F5F5"
    : lvl === 2
    ? "#FFDEAD"
    : "#FFFFE0";

const textColor = (sel) => (sel ? "#fff" : "#424242");
const iconColor = (lvl, sel) =>
  sel ? "#fff" : lvl === 0 ? "#ff7043" : "#757575";

/* ===============================================================
 * Pill – single clickable row inside the sidebar tree
 * =============================================================== */
const Pill = ({
  level,
  hasChildren,
  expanded,
  label,
  Icon,
  onClick,
  selected,
  actions,
}) => (
  <Box
    dir="rtl"
    onClick={onClick}
    sx={{
      backgroundColor: levelBg(level, selected),
      borderRadius: "999px",
      border:
        selected && level > 0 ? "2px solid #8B0000" : "1px solid transparent",
      px: 2,
      py: 0.5,
      mb: 1.5,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    {Icon && <Icon sx={{ fontSize: 18, color: iconColor(level, selected) }} />}
    <Typography
      sx={{
        flexGrow: 1,
        mr: 1,
        fontSize: 14,
        fontFamily: "IRANYekanWeb",
        color: textColor(selected),
        textAlign: "right",
      }}
    >
      {label}
    </Typography>
    {actions}
    {hasChildren &&
      (expanded ? (
        <ExpandLessRoundedIcon
          sx={{ fontSize: 20, color: textColor(selected) }}
        />
      ) : (
        <ExpandMoreRoundedIcon
          sx={{ fontSize: 20, color: textColor(selected) }}
        />
      ))}
  </Box>
);

/* ===============================================================
 * BoardRow – renders one floor with its bubbles
 * =============================================================== */
const BoardRow = ({
  row,
  onCircleClick,
  showFloorLabel,
  removedCirclesForRow,
  onMore,
}) => {
  const rowRef = useRef(null);
  const [rowW, setRowW] = useState(0);

  /* Observe width to calculate bubble capacity */
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRowW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Derive which bubbles are visible */
  const totalOriginal = row.bubbles + (row.more || 0);
  const removedSet = removedCirclesForRow || new Set();
  const total = totalOriginal - removedSet.size;

  const surviving = Array.from({ length: totalOriginal })
    .map((_, i) => i)
    .filter((i) => !removedSet.has(i));

  const capacityNoMore = Math.max(0,Math.floor(
    (rowW - LABEL_COL_W - COL_GAP) / (CIRCLE_SIZE + GAP)
  ));
  const needsMore = total > capacityNoMore;
  const capacity = Math.max(0,needsMore
    ? Math.floor(
        (rowW - LABEL_COL_W - COL_GAP - MORE_BOX_EST) / (CIRCLE_SIZE + GAP)
      )
    : capacityNoMore);
  const displayIndices = surviving.slice(0, capacity);
  const displayCircles = displayIndices.length;
  const remaining = total - displayCircles;

  /* Render row */
  return (
    <Box
      ref={rowRef}
      dir="rtl"
      sx={{
        display: "flex",
        gap: `${COL_GAP}px`,
        alignItems: "center",
        height: 72,
        mb: 1,
      }}
    >
      {/* ==== Right label column ==== */}
      <Paper
        elevation={1}
        sx={{
          width: LABEL_COL_W,
          height: "100%",
          display: "flex",
          alignItems: "center",
          px: 1.5,
        }}
      >
        {/* orange badge */}
        <Box sx={{ width: 64, display: "flex", justifyContent: "center" }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              bgcolor: "#ff7043",
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "IRANYekanWeb",
            }}
          >
            {showFloorLabel && (
              <Typography
                sx={{
                  fontSize: 10,
                  lineHeight: 1,
                  mb: "2px",
                  fontFamily: "IRANYekanWeb",
                }}
              >
                طبقه
              </Typography>
            )}
            <Typography
              sx={{ fontSize: 22, lineHeight: 1, fontFamily: "IRANYekanWeb" }}
            >
              {toFa(row.id)}
            </Typography>
          </Box>
        </Box>
        <Typography
          sx={{ fontSize: 16, fontFamily: "IRANYekanWeb", color: "#000" }}
        >
          {row.label}
        </Typography>
      </Paper>

      {/* ==== Left bubble column ==== */}
      <Paper
        elevation={1}
        sx={{
          flexGrow: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
          px: 2,
        }}
      >
        {/* visible bubbles */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: `${GAP}px`,
            flexGrow: 1,
          }}
        >
          {displayIndices.map((idx) => (
            <Box
              key={idx}
              role="button"
              aria-label={row.works?.[idx]?.title}
              tabIndex={0}
              onKeyDown={e=>{if(e.key==="Enter" || e.key===" "){e.preventDefault();onCircleClick(e,row,idx);}}}
              onClick={(e) => onCircleClick(e, row, idx)}
              sx={{
                width: CIRCLE_SIZE,
                height: CIRCLE_SIZE,
                borderRadius: "50%",
                bgcolor: "#e0e0e0",
                cursor: "pointer",
                "&:hover": { bgcolor: "#c7c7c7" },
              }}
            />
          ))}
        </Box>

        {/* “+x more” box */}
        {remaining > 0 && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              pl: "5px",
              textAlign: "left",
            }}
          >
            <Typography
              sx={{
                fontSize: 15,
                fontFamily: "IRANYekanWeb",
                color: "#424242",
              }}
            >
              {toFa(remaining)}+ کار دیگر
            </Typography>
            <Link
              component="button"
              onClick={()=>onMore(row.id)}
              aria-label={"مشاهده همه "+row.label}
              underline="none"
              sx={{
                mt: "2px",
                fontSize: 10,
                color: "#ff7043",
                fontFamily: "IRANYekanWeb",
                cursor: "pointer",
                textDecoration: "underline",
                textDecorationColor: "#ff7043",
                textUnderlineOffset: "2px",
              }}
            >
              مشاهده همه
            </Link>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

/* ===============================================================
 * BoardPreview – container of all BoardRow instances
 * =============================================================== */
const BoardPreview = ({
  rows,
  onCircleClick,
  showFloorLabel,
  removedCircles,
  onMore,
}) => (
  <Paper
    elevation={3}
    sx={{
      width: "100%",
      height: "100%",
      borderRadius: "8px",
      bgcolor: "#e0e0e0",
      p: 1,
      boxSizing: "border-box",
      overflow: "hidden",
    }}
  >
    {rows.map((row) => (
      <BoardRow
        key={row.id}
        row={row}
        onCircleClick={onCircleClick}
        onMore={onMore}
        showFloorLabel={showFloorLabel}
        removedCirclesForRow={removedCircles[row.id]}
      />
    ))}
  </Paper>
);

/* ===============================================================
 * Task data (unchanged demo arrays)
 * =============================================================== */
// const tasksInProgress = [
//   {
//     id: 1,
//     title: "دم اسب",
//     location: "طبقهٔ ۵ در ساختمان بعثت تا ظهور / اسب سوار",
//   },
//   {
//     id: 2,
//     title: "شکم اژدها",
//     location: "طبقهٔ ۳ در ساختمان بعثت تا ظهور / اژدها سوار",
//   },
//   {
//     id: 3,
//     title: "چرا جنگ با اسرائیل؟",
//     location: "طبقهٔ ۷ در ساختمان مستند اسرا / چرایی بحث؟",
//   },
//   {
//     id: 4,
//     title: "نور خورشید",
//     location: "طبقهٔ ۲ در ساختمان نورپردازی خورشید / آزمایش نور",
//   },
//   {
//     id: 5,
//     title: "سایه ماه",
//     location: "طبقهٔ ۶ در ساختمان پایگاه لونا / سایه‌شناسی",
//   },
//   {
//     id: 6,
//     title: "پل سنگی",
//     location: "طبقهٔ ۴ در ساختمان پروژه مترو / طراحی پل",
//   },
//   {
//     id: 7,
//     title: "پنجره آسمان",
//     location: "طبقهٔ ۱ در ساختمان برج آسمان / شیشه‌سازی",
//   },
//   {
//     id: 8,
//     title: "درخت بلوط",
//     location: "طبقهٔ ۷ در ساختمان مجتمع سبز / حفظ محیط",
//   },
//   {
//     id: 9,
//     title: "آبی دریایی",
//     location: "طبقهٔ ۳ در ساختمان دانشگاه هنر / رنگ‌شناسی",
//   },
//   {
//     id: 10,
//     title: "راه ابریشم",
//     location: "طبقهٔ ۲ در ساختمان تجارت بین‌الملل / مسیر کالا",
//   },
//   {
//     id: 11,
//     title: "قطب شمال",
//     location: "طبقهٔ ۶ در ساختمان ایستگاه قطبی / تحقیق یخ",
//   },
//   {
//     id: 12,
//     title: "گل یاس",
//     location: "طبقهٔ ۴ در ساختمان باغ گیاه‌شناسی / پرورش یاس",
//   },
//   {
//     id: 13,
//     title: "ستاره صبح",
//     location: "طبقهٔ ۵ در ساختمان رصدخانه ملی / مشاهده سیاره",
//   },
// ];

// const tasksDone = [
//   {
//     id: 101,
//     title: "شیر نر",
//     location: "طبقهٔ ۷ در ساختمان بعثت تا ظهور / حیات وحش",
//   },
//   {
//     id: 102,
//     title: "قایق چوبی",
//     location: "طبقهٔ ۲ در ساختمان بندر شمال / کشتی‌سازی",
//   },
//   {
//     id: 103,
//     title: "رعد آذرخش",
//     location: "طبقهٔ ۴ در ساختمان مرکز تحقیقات برق / آزمایش ولتاژ",
//   },
//   {
//     id: 104,
//     title: "کوه یخ",
//     location: "طبقهٔ ۳ در ساختمان جشنواره زمستان / مجسمه یخ",
//   },
//   {
//     id: 105,
//     title: "کویر لوت",
//     location: "طبقهٔ ۵ در ساختمان پروژه جغرافیا / عکس‌برداری هوایی",
//   },
//   {
//     id: 106,
//     title: "آسمان شب",
//     location: "طبقهٔ 1 در ساختمان دانشگاه نجوم / رصد کهکشان",
//   },
//   {
//     id: 107,
//     title: "باغ ایرانی",
//     location: "طبقهٔ ۶ در ساختمان نمایشگاه هنر / طراحی منظر",
//   },
//   {
//     id: 108,
//     title: "چشم‌انداز دریاچه",
//     location: "طبقهٔ ۲ در ساختمان برج آبی / رستوران گردان",
//   },
//   {
//     id: 109,
//     title: "نغمه باران",
//     location: "طبقهٔ ۴ در ساختمان استودیو صدا / ضبط افکت",
//   },
//   {
//     id: 110,
//     title: "مسیر کوهستان",
//     location: "طبقهٔ ۷ در ساختمان باشگاه دوچرخه / برنامه تمرین",
//   },
// ];

/* ===============================================================
 * TaskCard – mini card with its own 3‑second lock
 * =============================================================== */
const TaskCard = ({ task }) => {
  const [disabled, setDisabled] = useState(false);
  const navigate = useNavigate();

  const handleClick = () => {
    if (disabled) return;
    navigate(`/works/${encodeURIComponent(task.id)}`, {
      state: { title: task.title, from: "tasks" },
    });
    setDisabled(true);
    setTimeout(() => setDisabled(false), 3000);
  };

  return (
    <Paper
      elevation={1}
      sx={{
        width: 230,
        borderRadius: 2,
        py: 2,
        px: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      {/* local spinner */}
      <Backdrop open={disabled} sx={{ zIndex: 2000, color: "#fff" }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* placeholder image */}
      <Box
        sx={{
          width: "100%",
          height: 110,
          bgcolor: "#cfcfcf",
          backgroundImage:task.cover ? "url("+fileUrl(task.cover)+")" : undefined,
          backgroundPosition:"center",backgroundSize:"cover",
          borderRadius: 1,
        }}
      />

      {/* title */}
      <Typography
        dir="rtl"
        sx={{ fontWeight: 700, fontFamily: "IRANYekanWeb", fontSize: 16 }}
      >
        {task.title}
      </Typography>

      {/* location */}
      <Typography
        dir="rtl"
        sx={{
          fontSize: 12,
          color: "#424242",
          fontFamily: "IRANYekanWeb",
          textAlign: "center",
          lineHeight: 1.8,
        }}
      >
        {task.location}
      </Typography>

      {/* CTA button */}
      <Button
        fullWidth
        variant="contained"
        disabled={disabled}
        onClick={handleClick}
        sx={{
          mt: "auto",
          bgcolor: "#ff7043",
          "&:hover": { bgcolor: "#ff530c" },
          fontFamily: "IRANYekanWeb",
          borderRadius: "8px",
        }}
      >
        مشاهده
      </Button>
    </Paper>
  );
};

/* ===============================================================
 * TaskSection – expandable horizontal list of TaskCards
 * =============================================================== */
const TaskSection = ({ title, items }) => {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, 4);

  return (
    <Box sx={{ mb: 4 }}>
      {/* header row */}
      <Box
        dir="rtl"
        sx={{
          height: 56,
          bgcolor: "#f5f5f5",
          px: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <Typography
          sx={{
            fontSize: 18,
            fontWeight: 600,
            color: "#424242",
            fontFamily: "IRANYekanWeb",
          }}
        >
          {title}
        </Typography>

        {/* toggle link */}
        {items.length > 4 && (
          <Link
            component="button"
            underline="none"
            onClick={() => setExpanded((p) => !p)}
            sx={{
              position: "absolute",
              left: 20,
              fontSize: 14,
              color: "#ff7043",
              fontFamily: "IRANYekanWeb",
              cursor: "pointer",
              textDecoration: "underline",
              textDecorationColor: "#ff7043",
              textUnderlineOffset: "2px",
            }}
          >
            {expanded ? "بستن لیست" : "مشاهده همه"}
          </Link>
        )}
      </Box>

      {/* cards grid */}
      <Box
        sx={{
          mt: 3,
          px: 3,
          display: "flex",
          gap: 3,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {visibleItems.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </Box>
    </Box>
  );
};

/* ===============================================================
 * TasksPage – fetch works from server and render TaskCards
 * =============================================================== */
const TasksPage = ({projectId,floorNum}) => {
  // از سرور بخوان: در دست انجام + تمام شده
  const {
    data: inProgress = [],
    isLoading: loadingIP,
    error: errorIP,
    refetch: retryIP,
  } = useWorks({status:"in_progress",mine:projectId ? undefined : "true",projectId,floorNum});

  const {
    data: done = [],
    isLoading: loadingDone,
    error: errorDone,
    refetch: retryDone,
  } = useWorks({status:"done",mine:projectId ? undefined : "true",projectId,floorNum});

  // ⬅️ این دو خط: تبدیل رکوردهای سرور به شکل موردنیاز کارت‌ها
  const inProgressView = useMemo(
    () => inProgress.map(workToTaskItem),
    [inProgress]
  );
  const doneView = useMemo(() => done.map(workToTaskItem), [done]);

  // لودینگ/خطاهای ساده
  if (loadingIP || loadingDone) {
    return (
      <Paper
        elevation={3}
        sx={{
          width: "100%",
          height: "100%",
          borderRadius: "8px",
          bgcolor: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography sx={{ fontFamily: "IRANYekanWeb" }}>
          در حال بارگذاری لیست کارها…
        </Typography>
      </Paper>
    );
  }

  if (errorIP || errorDone) {
    return (
      <Paper
        elevation={3}
        sx={{
          width: "100%",
          height: "100%",
          borderRadius: "8px",
          bgcolor: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <QueryFeedback query={{isError:true,error:errorIP || errorDone,refetch:()=>Promise.all([retryIP(),retryDone()])}} label="دریافت فهرست کارها انجام نشد."/>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={3}
      sx={{
        width: "100%",
        height: "100%",
        borderRadius: "8px",
        bgcolor: "#fff",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ⬅️ اینجا خروجی map را پاس بده */}
      <TaskSection title="کارهای در دست انجام" items={inProgressView} />
      <TaskSection title="کارهای تمام شده" items={doneView} />
    </Paper>
  );
};

/* ===============================================================
 * Dashboard – top‑level exported component
 * =============================================================== */
export default function Dashboard() {
  const [params,setParams]=useSearchParams(),auth=useAuth(),action=useAction();
  const [selectedWork,setSelectedWork]=useState(null);
  const floor=Number(params.get("floor"));
  const allFloor=Number.isInteger(floor) && floor>=1 && floor<=7 ? floor : null;
  const selectedId=params.get("projectId") || (params.get("view")==="tasks" ? "tasks" : params.get("view")==="projects" ? "projects" : null);
  const selectedLevel=selectedId && !["tasks","projects"].includes(selectedId) ? 1 : null;
  const selectView=id=>{
    if(id===selectedId && allFloor===null)return;
    setParams(previous=>{
      const next=new URLSearchParams(previous);next.delete("floor");
      if(id==="tasks" || id==="projects") {next.delete("projectId");next.set("view",id);}
      else {next.set("projectId",id);next.delete("view");}
      return next;
    });
  };
  const setAllFloor=value=>setParams(previous=>{
    const next=new URLSearchParams(previous);
    if(value===null)next.delete("floor");else next.set("floor",String(value));
    return next;
  });
  const [deleteWorkOpen,setDeleteWorkOpen]=useState(false);
  const [projectMenu,setProjectMenu]=useState(null),[projectEditor,setProjectEditor]=useState(null),[projectDeletion,setProjectDeletion]=useState(null);
  /* sidebar state */
  const [openSidebar, setOpenSidebar] = useState(false);
  const [expandedIds, setExpandedIds] = useState([]);

  /* board state */
  const boardQuery=useWorks({projectId:selectedId},!!selectedId && !["tasks","projects"].includes(selectedId));
  const boardRows=useMemo(()=>initialBoardRows.map(row=>{
    const works=(boardQuery.data || []).filter(work=>work.floorNum===row.id);
    return {...row,works,bubbles:works.length,more:0};
  }),[boardQuery.data]);
  const [removedCircles] = useState({});

  /* dialog state */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [circleRect, setCircleRect] = useState(null);
  const [dialogContent, setDialogContent] = useState({ title: "", body: "" });
  const [dialogBtnDisabled, setDialogBtnDisabled] = useState(false);



  const sidebarWidth = openSidebar ? OPEN_WIDTH : CLOSED_WIDTH;

  const navigate = useNavigate();

  // ۱) گرفتن درخت پروژه‌ها از سرور
  const {
    data: projectTree = [],
    isLoading: projectsLoading,
    error: projectsError,
  } = useProjectTree();

  const selectedProject = useMemo(() => findProjectById(projectTree, selectedId), [projectTree, selectedId]);
  useEffect(()=>{
    if(!selectedId || ["tasks","projects"].includes(selectedId))return;
    const findAncestors=(nodes,path=[])=>{
      for(const node of nodes) {
        if(node.id===selectedId)return path;
        const found=findAncestors(node.children || [],[...path,node.id]);
        if(found)return found;
      }
      return null;
    };
    const ancestors=findAncestors(projectTree);
    if(ancestors)setExpandedIds(previous=>[...new Set([...previous,"projects",...ancestors])]);
  },[projectTree,selectedId]);
  const handleCreateWork = () => navigate("/create-work", {
    state: {
      startNewWork: true,
      selectedId: selectedProject?.id || null,
      selectedPath: selectedProject?.displayPath || selectedProject?.label || "",
    },
  });

  // ۲) ساخت treeData با آیکون‌های تاپ‌لول و children از سرور
  const treeData = useMemo(
    () => [
      { id: "tasks", label: "کارهای شما", icon: PersonRoundedIcon },
      {
        id: "projects",
        label: "پروژه‌ها",
        icon: AssignmentRoundedIcon,
        children: projectTree,
      },
    ],
    [projectTree]
  );

  /* ===== Sidebar helpers ===== */
  const toggleNode = useCallback((id) => {
    setExpandedIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
    );
  }, []);

  const renderNode = (node, level = 0) => {
    const hasChildren =
      Array.isArray(node.children) && node.children.length > 0;
    const expanded = expandedIds.includes(node.id);
    const selected = selectedId === node.id;
    return (
      <Fragment key={node.id}>
        <Pill
          level={level}
          hasChildren={hasChildren}
          expanded={expanded}
          label={node.label}
          Icon={node.icon}
          selected={selected}
          actions={selected && node.canManage ? <Tooltip title="مدیریت پروژه"><IconButton
            size="small" aria-label={"مدیریت پروژه "+node.label}
            onClick={event=>{event.stopPropagation();action.clearError();setProjectMenu({anchorEl:event.currentTarget,project:node});}}
            sx={{color:"inherit",p:0.25}}><MoreHorizRoundedIcon fontSize="small"/></IconButton></Tooltip> : null}
          onClick={() => {
            selectView(node.id);
            hasChildren && toggleNode(node.id);
          }}
        />
        {hasChildren && expanded && (
          <Box sx={{ mr: 3 }}>
            {node.children.map((c) => renderNode(c, level + 1))}
          </Box>
        )}
      </Fragment>
    );
  };

  /* ===== View selection ===== */
  const showTasks = selectedId === "tasks" || allFloor!==null;
  const showBoard = selectedLevel !== null && selectedLevel >= 1 && !showTasks;
  const showNoSelection = !showTasks && !showBoard;

  /* ===== Bubble helpers ===== */
  const createContent=(row,circleIdx)=>{
    const work=row.works[circleIdx];
    return {title:work.title,body:work.summary || ""};
  };
  const handleCircleClick=(e,row,idx)=>{
    const work=row.works[idx];if(!work)return;
    setCircleRect(e.currentTarget.getBoundingClientRect());
    setDialogContent(createContent(row,idx));setSelectedWork(work);
    setDialogBtnDisabled(false);setDialogOpen(true);
  };
  const handleDialogBtnClick=()=>{
    if(!selectedWork)return;
    setDialogOpen(false);navigate("/works/"+encodeURIComponent(selectedWork.id),{state:{from:"board"}});
  };
  const handleDeleteCircle=()=>{
    if(!selectedWork?.canEdit || action.pending)return;
    action.clearError();setDeleteWorkOpen(true);
  };
  const confirmDeleteWork=async()=>{
    if(action.pending || !selectedWork?.canEdit)return;
    if(await action.run(()=>api.delete("/works/"+encodeURIComponent(selectedWork.id)))) {
      setDeleteWorkOpen(false);setDialogOpen(false);
    }
  };
  const renameProject=async name=>{
    if(action.pending || !projectEditor)return;
    if(await action.run(()=>api.patch("/projects/"+encodeURIComponent(projectEditor.id),{name})))setProjectEditor(null);
  };
  const deleteProject=async()=>{
    if(action.pending || !projectDeletion)return;
    if(await action.run(()=>api.delete("/projects/"+encodeURIComponent(projectDeletion.id)))) {
      if(selectedId===projectDeletion.id)navigate("/dashboard",{replace:true});
      setProjectDeletion(null);
    }
  };
  const logout=async()=>{
    if(action.pending)return;
    if(await action.run(()=>auth.logout()))navigate("/login",{replace:true});
  };

  /* ===== Render ===== */
  return (
    <>
      <ConfirmDialog open={deleteWorkOpen} title="حذف کار" description="این کار، گزارش‌ها و فایل‌های آن حذف می‌شوند. ادامه می‌دهید؟"
        pending={action.pending} error={action.error} onClose={()=>{setDeleteWorkOpen(false);action.clearError();}} onConfirm={confirmDeleteWork}/>
      <Menu anchorEl={projectMenu?.anchorEl || null} open={!!projectMenu} onClose={()=>setProjectMenu(null)}
        PaperProps={{dir:"rtl",sx:{borderRadius:2,fontFamily:"IRANYekanWeb",'& .MuiMenuItem-root':{fontFamily:'inherit'}}}}>
        <MenuItem onClick={()=>{action.clearError();setProjectEditor(projectMenu.project);setProjectMenu(null);}}>
          <ListItemIcon><EditRoundedIcon sx={{color:"#ff7043"}} fontSize="small"/></ListItemIcon>تغییر نام پروژه
        </MenuItem>
        <MenuItem onClick={()=>{action.clearError();setProjectDeletion(projectMenu.project);setProjectMenu(null);}}>
          <ListItemIcon><DeleteOutlineRoundedIcon sx={{color:"#ff7043"}} fontSize="small"/></ListItemIcon>حذف پروژه
        </MenuItem>
      </Menu>
      {projectEditor && <TextDialog key={projectEditor.id} open title="تغییر نام پروژه" label="نام پروژه" initial={projectEditor.name || projectEditor.label}
        onClose={()=>{setProjectEditor(null);action.clearError();}} onSave={renameProject} pending={action.pending} error={action.error}/>}
      <ConfirmDialog open={!!projectDeletion} title="حذف پروژه" description={"پروژه «"+(projectDeletion?.name || projectDeletion?.label || "")+"» حذف شود؟ فقط پروژه‌های بدون کار و زیرپروژه قابل حذف‌اند."}
        onClose={()=>{setProjectDeletion(null);action.clearError();}} onConfirm={deleteProject} pending={action.pending} error={action.error}/>
      {/* Dialog loading indicator */}
      <Backdrop open={dialogBtnDisabled || action.pending || (showBoard && boardQuery.isLoading)} sx={{ zIndex: 2000, color: "#fff" }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Page styles */}
      <CssBaseline />
      <GlobalStyles
        styles={{
          "html, body, #root": {
            height: "100%",
            overflow: "hidden",
            margin: 0,
            fontFamily: "IRANYekanWeb",
            direction: "rtl",
          },
        }}
      />

      {/* gradient background */}
      <Box
        dir="rtl"
        sx={{
          position: "fixed",
          inset: 0,
          background:
            "linear-gradient(135deg,#ff931e 0%,#ff7b20 45%,#ec5561 100%)",
        }}
      >
        {/* main panel */}
        <Box
          sx={{
            position: "absolute",
            top: `${MARGIN}px`,
            bottom: `${MARGIN}px`,
            left: `${MARGIN}px`,
            right: `calc(${sidebarWidth}px + ${MARGIN * 2}px)`,
          }}
        >
          {showTasks && <TasksPage projectId={selectedId!=="tasks" ? selectedId : undefined} floorNum={allFloor || undefined}/>}

          {showBoard && boardQuery.isError && <Paper sx={{p:2,borderRadius:2}}><QueryFeedback query={boardQuery} label="دریافت کارهای پروژه انجام نشد. این وضعیت به معنی خالی‌بودن پروژه نیست."/></Paper>}
          {showBoard && !boardQuery.isError && (
            <BoardPreview
              rows={boardRows}
              onMore={setAllFloor}
              removedCircles={removedCircles}
              onCircleClick={handleCircleClick}
              showFloorLabel={!openSidebar}
            />
          )}

          {showNoSelection && (
            <Paper
              elevation={3}
              sx={{
                width: "100%",
                height: "100%",
                borderRadius: "8px",
                bgcolor: "#F5F5F5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography
                sx={{
                  fontSize: 22,
                  color: "#424242",
                  fontFamily: "IRANYekanWeb",
                }}
              >
                هنوز پروژه‌ای انتخاب نکردید
              </Typography>
            </Paper>
          )}
        </Box>

        {/* sidebar */}
        <Box
          sx={{
            position: "fixed",
            top: `${MARGIN}px`,
            bottom: `${MARGIN}px`,
            right: `${MARGIN}px`,
            width: `${sidebarWidth}px`,
            bgcolor: "#fff",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transition: TRANSITION,
          }}
        >
          {/* header (only expanded) */}
          {openSidebar && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                px: 2,
                pt: 1,
                pb: 2,
              }}
            >
              <IconButton
                disableRipple
                onClick={() => setOpenSidebar(false)}
                sx={{
                  color: "#757575",
                  borderRadius: "50%",
                  "&:hover": {
                    bgcolor: "rgba(0,0,0,0.08)",
                    color: "#ff7043",
                  },
                }}
              >
                <CloseRoundedIcon />
              </IconButton>
              <Typography
                sx={{
                  mr: 1,
                  fontSize: 18,
                  color: "#424242",
                  fontWeight: 500,
                  fontFamily: "IRANYekanWeb",
                }}
              >
                نوار کاربری
              </Typography>
            </Box>
          )}

          {/* tree or icons */}
          <Box
            sx={{
              flexGrow: 1,
              overflowY: "auto",
              px: openSidebar ? 2 : 0,
              mt: openSidebar ? 1 : 2,
              display: "flex",
              flexDirection: "column",
              alignItems: openSidebar ? "stretch" : "center",
            }}
          >
            {openSidebar ? (
              projectsLoading ? (
                <Typography
                  sx={{ p: 2, fontFamily: "IRANYekanWeb", color: "#9e9e9e" }}
                >
                  در حال بارگذاری پروژه‌ها...
                </Typography>
              ) : projectsError ? (
                <Typography
                  sx={{ p: 2, fontFamily: "IRANYekanWeb", color: "#d32f2f" }}
                >
                  خطا در دریافت پروژه‌ها
                </Typography>
              ) : (
                treeData.map((n) => renderNode(n))
              )
            ) : (
              <>
                <IconButton
                  disableRipple
                  onClick={() => setOpenSidebar(true)}
                  sx={{
                    color: "#757575",
                    "&:hover": { color: "#ff7043", bgcolor: "transparent" },
                    mb: 2,
                  }}
                >
                  <MenuRoundedIcon />
                </IconButton>
                <IconButton
                  aria-label="کارهای شما"
                  onClick={()=>selectView("tasks")}
                  disableRipple
                  sx={{
                    color: "#757575",
                    "&:hover": { color: "#ff7043", bgcolor: "transparent" },
                    mb: 2,
                  }}
                >
                  <PersonRoundedIcon />
                </IconButton>
                <IconButton
                  aria-label="پروژه‌ها"
                  onClick={()=>{setOpenSidebar(true);setExpandedIds(ids=>ids.includes("projects") ? ids : [...ids,"projects"]);}}
                  disableRipple
                  sx={{
                    color: "#757575",
                    "&:hover": { color: "#ff7043", bgcolor: "transparent" },
                  }}
                >
                  <AssignmentRoundedIcon />
                </IconButton>
              </>
            )}
          </Box>

          <Box sx={{ px: openSidebar ? 2 : 0, pt: 1.5, pb: 0.5, display: "flex", flexDirection: "column", alignItems: "center", gap: 1, flexShrink: 0 }}>
            <SidebarAction
              expanded={openSidebar}
              label="ایجاد کار"
              Icon={PlaylistAddRoundedIcon}
              onClick={handleCreateWork}
              disabled={projectsLoading}
              description={selectedProject ? "ایجاد کار در «" + selectedProject.displayPath + "»" : undefined}
            />
            <SidebarAction
              expanded={openSidebar}
              label="ایجاد پروژه"
              Icon={AddRoundedIcon}
              onClick={() => navigate("/create-project")}
            />
          </Box>

          <Box sx={{px:openSidebar ? 2 : 0,pb:1,display:"flex",justifyContent:"center"}}>
            <SidebarAction expanded={openSidebar} label="خروج از حساب" Icon={LogoutRoundedIcon} onClick={logout} disabled={action.pending}/>
          </Box>
          {action.error && !deleteWorkOpen && !projectEditor && !projectDeletion && <Typography role="alert" color="error" sx={{px:1,fontSize:12,textAlign:"center"}}>{action.error}</Typography>}
          {/* profile footer */}
          <Box
            sx={{
              mt: "auto",
              px: openSidebar ? 2 : 0,
              py: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: openSidebar ? "flex-start" : "center",
              gap: 1.5,
            }}
          >
            <Avatar
              src="https://tse1.mm.bing.net/th/id/OIP.5UvoM5ggGJ2oZjUpvudvxgHaJ3?w=474&h=474&c=7"
              sx={{ width: 56, height: 56 }}
            />
            {openSidebar && (
              <Box sx={{ textAlign: "right" }}>
                <Typography
                  sx={{
                    fontSize: 16,
                    fontWeight: 500,
                    fontFamily: "IRANYekanWeb",
                    color: "#000",
                  }}
                >
                  {auth.user.name}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 14,
                    color: "#9e9e9e",
                    fontFamily: "IRANYekanWeb",
                  }}
                >
                  {auth.user.username}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* bubble dialog */}
        {dialogOpen && circleRect && (
          <Box
            sx={{
              position: "fixed",
              inset: 0,
              bgcolor: "rgba(0,0,0,0.6)",
              zIndex: 1300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* highlight circle */}
            <Box
              sx={{
                position: "absolute",
                top: circleRect.top,
                left: circleRect.left,
                width: circleRect.width,
                height: circleRect.height,
                borderRadius: "50%",
                bgcolor: "#fff",
              }}
            />

            <Paper
              elevation={4}
              sx={{
                width: 300,
                maxWidth: "calc(100vw - 32px)",
                maxHeight: "calc(100dvh - 32px)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRadius: 2,
                px: 3,
                py: 2,
                position: "relative",
                textAlign: "center",
              }}
            >
              <IconButton
                onClick={() => {
                  setDialogOpen(false);
                  setDialogBtnDisabled(false);
                }}
                size="small"
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  color: "#424242",
                  "&:hover": { color: "#ff7043" },
                }}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>

              <Box
                sx={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  display: "flex",
                  gap: 1,
                }}
              >
                <IconButton size="small" disabled={!selectedWork?.canEdit || action.pending} onClick={()=>{setDialogOpen(false);navigate("/works/"+encodeURIComponent(selectedWork.id)+"/edit");}} sx={{ color: "#ff7043" }}>
                  <EditRoundedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label="حذف کار"
                  disabled={!selectedWork?.canEdit || action.pending}
                  onClick={handleDeleteCircle}
                  sx={{ color: "#ff7043" }}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Box>

              <Typography
                sx={{
                  mt: 4,
                  flexShrink: 0,
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: "IRANYekanWeb",
                }}
              >
                {dialogContent.title}
              </Typography>
              <Typography
                component="div"
                role="region"
                aria-label="توضیحات کار"
                tabIndex={0}
                sx={{
                  mt: 1.5,
                  minHeight: 0,
                  maxHeight: "min(280px, 40dvh)",
                  overflowY: "auto",
                  overflowX: "hidden",
                  overflowWrap: "anywhere",
                  whiteSpace: "pre-wrap",
                  overscrollBehavior: "contain",
                  scrollbarWidth: "thin",
                  fontSize: 14,
                  lineHeight: 2,
                  fontFamily: "IRANYekanWeb",
                  color: "#424242",
                }}
              >
                {dialogContent.body}
              </Typography>

              <Button
                fullWidth
                variant="contained"
                disabled={dialogBtnDisabled}
                onClick={handleDialogBtnClick}
                sx={{
                  mt: 3,
                  flexShrink: 0,
                  bgcolor: "#ff7043",
                  "&:hover": { bgcolor: "#ff530c" },
                  fontFamily: "IRANYekanWeb",
                  borderRadius: "12px",
                }}
              >
                مشاهده کامل کار
              </Button>
            </Paper>
          </Box>
        )}
      </Box>
    </>
  );
}
