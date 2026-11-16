/* shared/ui/atoms/StatusIndicator — generic dot + label status atom.
   Boundary test: describable without composers/sessions — the tone is a
   plain prop, the atom has NO domain knowledge (the composer→tone mapping
   lives in features/app-shell). Styling: tokens (src/shared/ui/tokens.css)
   only; imports react types only. */

import type { JSX } from "react";

/** Visual class of the status dot. */
export type StatusTone = "positive" | "warning" | "muted";

/** Props of the dot+label status atom. */
export interface StatusIndicatorProps {
  /** Dot color class: positive→teal, warning→amber, muted→muted text color. */
  tone: StatusTone;
  /** Visible + announced text (role=status, polite). */
  label: string;
}

const dotColor: Record<StatusTone, string> = {
  positive: "var(--accent-teal)",
  warning: "var(--accent-amber)",
  muted: "var(--text-muted)",
} as const;

/** Glow token per tone (stitch-appshell-ref §3: tight small-radius glow for
    the AI-telemetry dot; muted state carries no glow). */
const dotGlow: Record<StatusTone, string> = {
  positive: "var(--accent-glow-teal)",
  warning: "var(--accent-glow-amber)",
  muted: "none",
} as const;

const dotStyle = {
  // WHY: stitch-appshell-ref §3 — the telemetry dot is 6px with a 6px gap to
  // the label; --sp-xs/sm (4/8px) do not hit the spec size and no 6px spacing
  // token exists, so these two metric values are spec-quoted, not colors.
  width: "6px",
  height: "6px",
  borderRadius: "var(--r-pill)",
  display: "inline-block",
} as const;

const wrapperStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  color: "var(--text-muted)",
  font: "var(--label-caps)",
  textTransform: "uppercase",
} as const;

export function StatusIndicator({ tone, label }: StatusIndicatorProps): JSX.Element {
  return (
    <span role="status" aria-live="polite" style={wrapperStyle}>
      <span
        aria-hidden
        style={{
          ...dotStyle,
          background: dotColor[tone],
          boxShadow: dotGlow[tone],
        }}
      />
      {label}
    </span>
  );
}
