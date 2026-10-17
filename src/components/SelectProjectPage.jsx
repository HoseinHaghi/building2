/********************************************************************
 * SelectProjectPage.jsx
 *
 * A right-to-left (RTL) “Select Project” dialog built with React and
 * Material-UI (MUI).  Key features
 *   • Expandable tree view to pick a project (three nesting levels)
 *   • A global 3-second UI lock that simulates an async request and
 *     blocks all controls while the faux request is “in flight”
 *   • Fully fixed-height white card (CARD_H = 400 px) so the tree
 *     portion becomes scrollable when content exceeds the viewport
 *   • Persian (Farsi) labels throughout
 *
 * Reminder: Only comments have been added or rewritten; every
 * executable line remains byte-for-byte identical to your file
 * (except wiring selection up to the parent and returning state).
 ********************************************************************/
// Explain: Import React core and specific hooks used in this component file.
import { useState, useEffect, useRef, useCallback } from "react";
// Explain: Import MUI layout and feedback components used for the UI.
import {
  Box,
  Paper,
  Typography,
  Collapse,
  IconButton,
  Button,
  Backdrop,
  CircularProgress,
} from "@mui/material";
// Explain: Import MUI icons for expand/collapse affordances.
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/esm/KeyboardArrowDownRounded.js";
// Explain: Upward arrow icon to indicate an expanded state.
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/esm/KeyboardArrowUpRounded.js";
// Explain: Close icon used to dismiss/go back from the page.
import CloseRoundedIcon from "@mui/icons-material/esm/CloseRounded.js";
// Explain: React Router hook to programmatically navigate between routes.
import { useNavigate, useLocation } from "react-router-dom";
// Explain: Custom hook to fetch/prepare the project tree data from the server.
import { useProjectTree } from "../hooks/useProjectTree"; // <-- NEW

// Explain: Design tokens and style constants used across the page.
/* styles */
const fontFamily = "IRANYekanWeb, sans-serif"; // Explain: Preferred font stack for typography.
const levelBg = ["#F5F5F5", "#FFF1F0", "#FFF8E1"]; // Explain: Background color per nesting level.
const highlight = "#ff7043"; // Explain: Accent/highlight color for selected states.
const selectedBg = "rgba(255,112,67,0.15)"; // Explain: Subtle background for selected items.
const CARD_H = 400; // Explain: Fixed card height to contain the tree.

// Explain: Utility to find the path (breadcrumb) from root to a node id.
/* --- NEW: helper to build breadcrumb path for a selected id --- */
function findPathById(nodes, targetId, path = []) {
  // Explain: Guard—only proceed if nodes is an array.
  if (!Array.isArray(nodes)) return null;
  // Explain: Iterate through nodes at the current level.
  for (const n of nodes) {
    // Explain: Build the next path including the current node.
    const next = [...path, n];
    // Explain: If the current node matches target id (string-safe compare), return accumulated path.
    if (String(n.id) === String(targetId)) return next;
    // Explain: If the node has children, recurse into them to search deeper.
    if (n.children?.length) {
      const found = findPathById(n.children, targetId, next);
      // Explain: If a path was found in a subtree, propagate it upward.
      if (found) return found;
    }
  }
  // Explain: Not found in this subtree.
  return null;
}

// Explain: Single tree node component rendered recursively for each item.
/* ---------------- Node (recursive) ---------------- */
function Node({ node, level = 0, selectedId, onSelect }) {
  // Explain: Local open/closed state for collapsing/expanding children.
  const [open, setOpen] = useState(false);
  // Explain: Whether this node has children to display.
  const hasChildren = !!node.children?.length;
  // Explain: Whether this node is currently selected.
  const isSelected = selectedId === node.id;

  // Explain: Render the node container and its optional children.
  return (
    <Box sx={{ width: "100%" }}>
      {/* Explain: Clickable header row representing the node itself. */}
      <Box
        dir="rtl"
        onClick={() => {
          // Explain: Toggle open state only if there are children to show.
          if (hasChildren) setOpen((p) => !p);
          // Explain: Inform parent about selection for this node id.
          onSelect(node.id);
        }}
        sx={{
          cursor: "pointer", // Explain: Indicate interactivity.
          userSelect: "none", // Explain: Avoid accidental text selection while clicking.
          bgcolor: isSelected ? selectedBg : levelBg[level] || levelBg[0], // Explain: Background depends on selection/level.
          border: isSelected ? `1px solid ${highlight}` : "none", // Explain: Outline the selected node.
          borderRadius: isSelected ? 20 : 12, // Explain: Slightly larger radius when selected.
          height: 40, // Explain: Fixed row height for consistency.
          boxSizing: "border-box", // Explain: Include borders/padding in height.
          px: 2, // Explain: Horizontal padding.
          mb: 1.5, // Explain: Space below each node row.
          display: "flex", // Explain: Flex layout for label and icon.
          flexDirection: "row", // Explain: Arrange label and icon horizontally.
          alignItems: "center", // Explain: Vertically center contents.
          justifyContent: "space-between", // Explain: Push label and chevron to edges.
          transition: "all .2s", // Explain: Smooth hover/open state changes.
        }}
      >
        {/* Explain: Node label with RTL text support and overflow ellipsis. */}
        <Typography
          sx={{
            fontFamily, // Explain: Use shared font.
            fontSize: 14, // Explain: Compact label size.
            textAlign: "right", // Explain: Right-align for RTL.
            color: isSelected ? highlight : "#000", // Explain: Accent color when selected.
            overflow: "hidden", // Explain: Prevent layout break with long labels.
            whiteSpace: "nowrap", // Explain: Single-line label.
            textOverflow: "ellipsis", // Explain: Show ellipsis for overflow.
          }}
        >
          {node.label}
        </Typography>

        {/* Explain: If the node has children, show an affordance to reflect open/closed state. */}
        {hasChildren && (
          <IconButton size="small" sx={{ mr: 1, color: "#000" }} disableRipple>
            {open ? (
              <KeyboardArrowUpRoundedIcon fontSize="small" />
            ) : (
              <KeyboardArrowDownRoundedIcon fontSize="small" />
            )}
          </IconButton>
        )}
      </Box>

      {/* Explain: Render the children recursively inside a collapse region when open. */}
      {hasChildren && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{ pr: 3 }}>
            {node.children.map((child) => (
              <Node
                key={child.id} // Explain: Unique key helps React reconcile lists.
                node={child} // Explain: Pass the child node down.
                level={level + 1} // Explain: Increase level for styling (indent/background).
                selectedId={selectedId} // Explain: Bubble selection down so child can style itself.
                onSelect={onSelect} // Explain: Reuse selection handler from parent.
              />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}

// Explain: Tree wrapper that renders top-level nodes using the recursive Node component.
/* --------------- Tree (now uses server data passed from parent) --------------- */
function ProjectTree({ data, selectedId, onSelect }) {
  // Explain: Normalize incoming data to an array to avoid runtime errors.
  const tree = Array.isArray(data) ? data : [];

  // Explain: Render each root node.
  return (
    <Box sx={{ width: "100%", mt: 1 }}>
      {tree.map((node) => (
        <Node
          key={node.id} // Explain: Unique key for React list rendering.
          node={node} // Explain: Provide the node object to the recursive component.
          selectedId={selectedId} // Explain: Forward selected id for highlighting.
          onSelect={onSelect} // Explain: Forward selection callback.
        />
      ))}
    </Box>
  );
}

// Explain: Footer-like panel that shows the tree and a confirm/select button.
/* --------------- Footer panel (select button) --------------- */
function TabCustom({ isLocked, lockUI, selectedId, setSelectedId, data }) {
  // Explain: Hook to navigate to a different route when selection is confirmed.
  const navigate = useNavigate();
  const location = useLocation();

  const returnTo = ["/create-project","/create-work"].includes(location.state?.from) ? location.state.from : "/create-project";
  const incomingDraft = location.state?.draft || {};

  // Explain: Handle click on the confirm button—computes breadcrumb and navigates back.
  const handleClick = () => {
    if (!selectedId) return;

    const pathNodes = findPathById(data, selectedId) || [];
    const selectedPath = pathNodes.map((n) => n.label).join(" > ");

    lockUI();
    navigate(returnTo, {
      replace: true,
      state: {
        draft: incomingDraft,
        selectedId,
        selectedPath,
      },
    });
  };

  // Explain: Layout wrapper for the tree and the confirm button.
  return (
    <Box
      sx={{
        position: "relative", // Explain: Allows absolutely-positioned children if needed.
        flex: 1, // Explain: Fill available vertical space in the parent column.
        px: 4, // Explain: Horizontal padding around content.
        display: "flex", // Explain: Column layout for tree + button.
        flexDirection: "column",
      }}
    >
      {/* Explain: Scrollable container for the tree area. */}
      <Box
        sx={{
          width: "100%",
          flex: "1 1 0", // Explain: Grow to fill remaining space.
          overflowY: "auto", // Explain: Allow scrolling when tree is tall.
          pr: 0.5, // Explain: Slight right padding to avoid scrollbar overlap.
          mb: 3, // Explain: Space below the tree before the button.
        }}
      >
        <ProjectTree
          data={data} // Explain: Tree data fetched from the server (via hook in parent).
          selectedId={selectedId} // Explain: Current selection to highlight nodes.
          onSelect={setSelectedId} // Explain: Update selection when a node is clicked.
        />
      </Box>

      {/* Explain: Primary action to confirm the current selection. */}
      <Button
        fullWidth
        variant="contained"
        disabled={isLocked || !selectedId} // Explain: Disable while locking or when nothing is selected.
        onClick={handleClick} // Explain: Commit selection and navigate.
        sx={{
          backgroundColor: highlight, // Explain: Use accent color for prominence.
          borderRadius: 10, // Explain: Rounded button shape.
          height: 40, // Explain: Compact, consistent height.
          fontFamily, // Explain: Use shared font.
          fontSize: 15, // Explain: Readable size in a small card.
          color: "#fff", // Explain: Contrast text for accessibility.
          boxShadow: "none", // Explain: Flat style (MUI default shadows removed).
          "&:hover": { backgroundColor: "#e65100", boxShadow: "none" }, // Explain: Darker hover state.
          "&.Mui-disabled": {
            backgroundColor: "rgba(0,0,0,0.26)", // Explain: Standard disabled appearance.
            color: "#fff",
          },
        }}
      >
        انتخاب
      </Button>
    </Box>
  );
}

// Explain: The page component that orchestrates data fetching, selection state, and layout.
/* ---------------------- Page wrapper ---------------------- */
export default function SelectProjectPage() {
  // Explain: Indicates whether the UI is temporarily locked (e.g., during navigation).
  const [isLocked, setIsLocked] = useState(false);
  // Explain: Holds the currently selected node id (or null when nothing is selected).
  const [selectedId, setSelectedId] = useState(null);
  // Explain: Ref to store a timeout id so we can clear/restart the lock timer.
  const lockTimer = useRef(null);
  // Explain: Router navigate function used for closing/back navigation (icon button).
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedId = location.state?.preselectedId ?? null;
  const returnTo = ["/create-project","/create-work"].includes(location.state?.from) ? location.state.from : "/create-project";

  // Explain: Fetch the project tree from the server using a custom hook.
  const { data, isLoading, error } = useProjectTree();

  useEffect(() => {
    if (preselectedId) setSelectedId(preselectedId);
  }, [preselectedId]);

  // Explain: Memoized function to lock the UI for a short period (e.g., after select).
  const lockUI = useCallback(() => {
    // Explain: If already locked, prevent re-locking and restarting the timer.
    if (isLocked) return;
    // Explain: Enter locked state immediately.
    setIsLocked(true);
    // Explain: Clear any previous unlock timer to avoid overlap.
    clearTimeout(lockTimer.current);
    // Explain: Start a new timer to unlock the UI after 3 seconds.
    lockTimer.current = setTimeout(() => setIsLocked(false), 3000);
  }, [isLocked]);

  // Explain: Cleanup the unlock timer when the component unmounts.
  useEffect(() => () => clearTimeout(lockTimer.current), []);

  // Explain: Render the page scaffolding, backdrop during lock, and main card.
  return (
    <>
      {/* Explain: Full-screen overlay to indicate blocked interaction while locked. */}
      <Backdrop open={isLocked} sx={{ zIndex: 2000, color: "#fff" }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Explain: Center the card vertically and horizontally with RTL direction. */}
      <Box
        dir="rtl"
        sx={{
          minHeight: "100vh", // Explain: Make container at least viewport height.
          width: "100%", // Explain: Stretch across horizontally.
          display: "flex", // Explain: Use flex to center content.
          alignItems: "center", // Explain: Vertical centering.
          justifyContent: "center", // Explain: Horizontal centering.
        }}
      >
        {/* Explain: The main card surface housing title, tree, and action. */}
        <Paper
          elevation={3} // Explain: Subtle drop shadow to lift the card.
          sx={{
            borderRadius: 5, // Explain: Rounded corners for the card.
            width: 380, // Explain: Fixed width for consistent layout.
            height: CARD_H, // Explain: Match earlier constant to control internal scroll.
            display: "flex", // Explain: Vertical stacking inside.
            flexDirection: "column",
            py: 4, // Explain: Vertical padding for breathing room.
            pointerEvents: isLocked ? "none" : "auto", // Explain: Block interactions when locked.
          }}
        >
          {/* Explain: Title row with centered text and an absolute-positioned close button. */}
          <Box sx={{ position: "relative", mb: 4 }}>
            <Typography
              sx={{
                fontFamily, // Explain: Use shared font.
                fontSize: 29, // Explain: Prominent page title.
                color: "#000", // Explain: High-contrast black text.
                textAlign: "center", // Explain: Center title text.
              }}
            >
              انتخاب پروژه
            </Typography>

            {/* Explain: Top-right close icon to go back to the previous route. */}
            <IconButton
              disableRipple // Explain: Keep click feedback minimal/clean.
              onClick={() =>
                navigate(returnTo, {
                  replace: true,
                  // ✅ فقط draft را برگردان تا فرم صفحهٔ قبل پاک نشود
                  state: { draft: location.state?.draft || {} },
                })
              }
              sx={{
                position: "absolute", // Explain: Position within the title container.
                top: -12, // Explain: Slightly above to align visually.
                right: 12, // Explain: Right aligned in RTL container.
                color: "#000", // Explain: Neutral black color.
                borderRadius: "50%", // Explain: Circular hit area.
                transition: "background-color .2s", // Explain: Smooth hover feedback.
                "&:hover": { backgroundColor: "rgba(0,0,0,0.08)" }, // Explain: Subtle hover background.
              }}
              aria-label="close" // Explain: Accessibility label for screen readers.
            >
              <CloseRoundedIcon sx={{ fontSize: 28 }} />
            </IconButton>
          </Box>

          {/* Explain: Conditional content—show loading or error; otherwise render the tree and button. */}
          {/* NEW: show loading/error here, otherwise render TabCustom */}
          {isLoading ? (
            <Box sx={{ px: 4, mt: 2 }}>
              <Typography sx={{ fontFamily, fontSize: 14 }}>
                در حال بارگذاری پروژه‌ها...
              </Typography>
            </Box>
          ) : error ? (
            <Box sx={{ px: 4, mt: 2 }}>
              <Typography color="error" sx={{ fontFamily, fontSize: 14 }}>
                خطا در دریافت پروژه‌ها
              </Typography>
            </Box>
          ) : (
            <TabCustom
              isLocked={isLocked} // Explain: Pass current lock state for button disabling.
              lockUI={lockUI} // Explain: Provide the lock function to the child.
              selectedId={selectedId} // Explain: Current selection for highlighting and enabling the button.
              setSelectedId={setSelectedId} // Explain: Callback to update selection on node click.
              data={data || []} // pass tree down // Explain: Ensure child always gets an array.
            />
          )}
        </Paper>
      </Box>
    </>
  );
}
