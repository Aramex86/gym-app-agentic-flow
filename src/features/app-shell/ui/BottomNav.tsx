/* features/app-shell/ui/BottomNav — renders the stitch 3-slot bar
   (stitch gate decision 2 / stitch-appshell-ref §2): flat My Plan and
   Progress tabs flank a raised center FAB that targets the Logger route;
   Onboarding stays off the bar (route exists at /onboarding). Owns the
   router glue (plan A8/A4): tabs are dumb <a> atoms, this component reads
   useLocation and calls useNavigate on select. The active slot is a pure
   function of the URL → reload-safe by construction. */

import type { JSX, MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavTab } from "@shared/ui";
import {
  NAV_FAB_ID,
  NAV_TAB_IDS,
  activeNavSurface,
  navSurfaceById,
} from "@shared/config/nav";
import type { NavSurfaceId } from "@shared/config/nav";

/* Row fills the shell's fixed glass nav bar; colors/borders live there. */
const navStyle = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-around",
  padding: "0 var(--sp-md)",
} as const;

/* WHY: stitch-appshell-ref §2 — the center action is a raised 52px circle
   (volt bg + volt glow, −12px lift out of the 64px bar); a 52px target has
   no spacing token, so the px values are spec-quoted. */
const fabStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "52px",
  height: "52px",
  marginTop: "-12px",
  borderRadius: "var(--r-pill)",
  background: "var(--accent-volt)",
  boxShadow: "var(--accent-glow-volt)",
  color: "var(--canvas)",
  textDecoration: "none",
  cursor: "pointer",
} as const;

/** Inline bolt glyph (FAB icon); currentColor keeps it token-clean. */
function BoltIcon(): JSX.Element {
  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" />
    </svg>
  );
}

export function BottomNav(): JSX.Element {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeId = activeNavSurface(pathname);
  const fabSurface = navSurfaceById(NAV_FAB_ID);
  const fabPath = fabSurface?.path ?? "/logger";
  const fabLabel = fabSurface?.label ?? "Logger";

  function handleFabClick(event: MouseEvent<HTMLAnchorElement>): void {
    // Same A8 glue as NavTab: real href, default hop cancelled.
    event.preventDefault();
    navigate(fabPath);
  }

  function renderTab(id: NavSurfaceId): JSX.Element | null {
    const surface = navSurfaceById(id);
    if (!surface) return null;
    return (
      <NavTab
        label={surface.label}
        href={surface.path}
        active={surface.id === activeId}
        onSelect={() => navigate(surface.path)}
      />
    );
  }

  return (
    <nav aria-label="Main navigation" style={navStyle}>
      {/* WHY: DOM order IS the bar's slot order — left tab, FAB, right tab. */}
      {renderTab(NAV_TAB_IDS[0])}
      <a
        href={fabPath}
        aria-label={fabLabel}
        aria-current={activeId === NAV_FAB_ID ? "page" : undefined}
        onClick={handleFabClick}
        style={fabStyle}
      >
        <BoltIcon />
      </a>
      {renderTab(NAV_TAB_IDS[1])}
    </nav>
  );
}
