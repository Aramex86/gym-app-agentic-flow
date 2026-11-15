/* shared/ui/atoms/StatCard — dumb, token-styled metric card (label + value).
   Boundary test: describable without plans/users/orders (ADR-0001 D5).
   Props in, no state, no data logic. `value` is preformatted by the caller
   (units included) — the atom does no formatting (plan assumption A3).
   Styling: tokens (src/shared/ui/tokens.css) only — no hex, no rgb.
   Tone semantics (plan A2): muted = historical/label emphasis
   (--text-muted), accent = primary metric (--accent-volt); card chrome
   (surface/edge/radius/spacing) is identical for both tones. */

import type { JSX } from "react";

export type StatCardTone = "muted" | "accent";

export interface StatCardProps {
  /** Metric name; rendered in the label-caps role. */
  label: string;
  /** Preformatted metric value (units included by the caller, A3). */
  value: string;
  /** Value emphasis: muted history/label vs accent primary metric (A2). */
  tone: StatCardTone;
}

const cardStyle = {
  display: "grid",
  gap: "var(--sp-xs)",
  padding: "var(--sp-md)",
  background: "var(--surface)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-card)",
} as const;

const labelStyle = {
  font: "var(--label-caps)",
  color: "var(--text-muted)",
  textTransform: "uppercase",
} as const;

// WHY the font shorthand: csstype types `fontWeight` as a closed union and
// rejects `var(--…)`; `font` accepts arbitrary strings (same pattern as the
// existing `--label-caps` usages). This keeps the weight token-driven (R4).
const valueStyle = {
  font: "var(--metric-lg-weight) var(--metric-lg-size) var(--font-metric)",
} as const;

const toneStyles = {
  muted: { ...valueStyle, color: "var(--text-muted)" },
  accent: { ...valueStyle, color: "var(--accent-volt)" },
} as const;

export function StatCard({ label, value, tone }: StatCardProps): JSX.Element {
  return (
    <div style={cardStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={toneStyles[tone]}>{value}</span>
    </div>
  );
}
