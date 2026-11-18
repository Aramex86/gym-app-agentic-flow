/* shared/ui/atoms/NavTab — dumb, token-styled bottom-nav tab link.
   Boundary test: describable without plans/users/routes — no router, no
   data (plan A8: the feature layer owns useNavigate; the atom stays a real
   <a href> so open-in-new-tab/right-click semantics are preserved).
   Styling: tokens (src/shared/ui/tokens.css) only; imports react types only. */

import type { JSX, MouseEvent } from "react";

/** Props of the bottom-navigation tab atom. */
export interface NavTabProps {
  /** Visible and accessible text of the tab. */
  label: string;
  /** href of the link; the feature's router owns navigating to it. */
  href: string;
  /** Whether this tab is the current page (drives styling + aria-current). */
  active: boolean;
  /** Invoked on click instead of the default anchor navigation. */
  onSelect: () => void;
}

const inactiveStyle = {
  flex: "1 1 0",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "var(--sp-sm) var(--sp-xs)",
  borderRadius: "var(--r-btn)",
  font: "var(--label-caps)",
  textTransform: "uppercase",
  textDecoration: "none",
  cursor: "pointer",
  background: "transparent",
  color: "var(--text-muted)",
} as const;

// WHY: stitch-appshell-ref §2 — active tab is a COLOR-SWAP ONLY (volt text,
// no background pill, no dot/underline); the previous volt-filled pill is a
// divergence from the spec'd shell.
const activeStyle = {
  ...inactiveStyle,
  color: "var(--accent-volt)",
} as const;

export function NavTab({ label, href, active, onSelect }: NavTabProps): JSX.Element {
  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    // WHY: plan A8 — SPA navigation via the feature's router; the href stays
    // real so the link semantics survive, only the default hop is cancelled.
    event.preventDefault();
    onSelect();
  }
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={handleClick}
      style={active ? activeStyle : inactiveStyle}
    >
      {label}
    </a>
  );
}
