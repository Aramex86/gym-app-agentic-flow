/* shared/ui — persistent app shell ("Kinetic Obsidian").
   Styling via tokens (src/shared/ui/tokens.css) only — ADR-0001 D5.
   Chrome shape per stitch-appshell-ref §1–2: fixed 64px glass header bar
   (two-line brand stack; the telemetry indicator is the second line) and a
   fixed 64px glass bottom-nav bar. The shell stays domain-free: it owns
   only generic slots, never composer/nav copy or health logic. */

import type { CSSProperties, ReactNode } from "react";
import { SITE } from "@shared/config/site";

/** Value used for the glass bars' backdrop blur (stitch: backdrop-blur-xl).
    A blur radius is not a color, so it stays a plain value in the shell. */
const GLASS_BLUR = "blur(12px)";

export type AppShellProps = {
  children: ReactNode;
  title?: string;
  sessionStatus?: string;
  /** Content of the header's second brand line (telemetry indicator). */
  headerRight?: ReactNode;
  /** Rendered between <main> and the footer (bottom navigation). */
  bottomNav?: ReactNode;
};

const headerStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 50,
  height: "var(--shell-bar-h)",
  background: "var(--surface-glass)",
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
  // WHY: stitch-appshell-ref §1 — the fixed glass header carries a small
  // ambient shadow; the rgba lives in the token (color gate keeps TSX clean).
  boxShadow: "var(--shadow-glass-top)",
};

const headerRowStyle: CSSProperties = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 var(--sp-gutter)",
};

const brandStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "var(--sp-xs)",
};

// WHY: stitch-appshell-ref §1 — brand line 1 is headline-sm (Space Grotesk
// 18px/24px, 600, UPPERCASE); AppShell previously used a raw 24px heading.
const brandTitleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-heading)",
  fontSize: "18px",
  lineHeight: "24px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-high)",
};

const navSlotStyle: CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 50,
  height: "var(--shell-bar-h)",
  background: "var(--surface-glass)",
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
  boxShadow: "var(--shadow-glass-bottom)",
};

export function AppShell({
  children,
  title = SITE.name,
  sessionStatus = "Session active",
  headerRight,
  bottomNav,
}: AppShellProps) {
  return (
    <div
      className="app-shell"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--canvas)",
        color: "var(--text-high)",
        fontFamily: "var(--font-body)",
      }}
    >
      <header className="app-shell__header" style={headerStyle}>
        <div className="app-shell__header-row" style={headerRowStyle}>
          <div className="app-shell__brand" style={brandStyle}>
            <h1 style={brandTitleStyle}>{title}</h1>
            {/* Second brand line (stitch-appshell-ref §1 line 2): the slot
                content is generic — copy/tone mapping stays in the feature. */}
            <div
              className="app-shell__header-right"
              style={{ display: "flex", alignItems: "center", gap: "var(--sp-sm)" }}
            >
              {headerRight}
            </div>
          </div>
        </div>
      </header>

      <main
        className="app-shell__main"
        style={{
          flex: 1,
          background: "var(--surface-lifted)",
          // Offsets the fixed header so content starts below the glass bar.
          paddingTop: "var(--shell-bar-h)",
        }}
      >
        {children}
      </main>

      {bottomNav != null ? <div className="app-shell__nav" style={navSlotStyle}>{bottomNav}</div> : null}

      {/* The session footer stays in flow; its bottom margin clears the fixed
          nav bar so the two never overlap at the end of the scroll. */}
      <footer
        className="app-shell__footer"
        style={{
          padding: "var(--sp-xs) var(--sp-gutter)",
          marginBottom: bottomNav != null ? "var(--shell-bar-h)" : undefined,
          borderTop: "1px solid var(--edge)",
          color: "var(--text-muted)",
        }}
      >
        {sessionStatus}
      </footer>
    </div>
  );
}
