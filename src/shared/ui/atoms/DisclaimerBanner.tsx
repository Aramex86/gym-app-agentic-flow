/* shared/ui/atoms/DisclaimerBanner — dumb, token-styled medical disclaimer
   banner (ADR-0001 D4, tokens per D5). Layer: shared/ui/atoms — it is
   domain-free presentational chrome: props in, fixed copy out, no state,
   no effects, no data access (AGENTS.md data rule). Variant selects the
   base line only ("basic") or base + doctor warning ("disease"); the
   caller decides which. Styling: design tokens only (tokens.css), never
   hex/rgb. */

import type { JSX } from "react";

export type DisclaimerVariant = "basic" | "disease";

export interface DisclaimerBannerProps {
  /** Selects the base line only (basic) or base + doctor warning (disease). */
  variant: DisclaimerVariant;
  /** Optional consumer class for layout spacing; styling stays token-only. */
  className?: string;
}

const BASE_LINE =
  "This plan is not medical advice. Stop and consult a professional if pain occurs.";
const DOCTOR_LINE =
  "You listed health conditions in your profile. Consult a doctor before starting this plan.";

const paragraphStyle = {
  margin: 0,
} as const;

const basicStyle = {
  padding: "var(--sp-sm) var(--sp-md)",
  background: "var(--surface)",
  color: "var(--text-muted)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-card)",
  font: "var(--label-caps)",
} as const;

// WHY: plan Step 1 — the warning variant is the same chrome, only surface
// and emphasis lift, with the border on the disclaimer token (--accent-amber).
const diseaseStyle = {
  ...basicStyle,
  background: "var(--surface-lifted)",
  color: "var(--text-high)",
  borderColor: "var(--accent-amber)",
} as const;

export function DisclaimerBanner({
  variant,
  className,
}: DisclaimerBannerProps): JSX.Element {
  const isDisease = variant === "disease";

  return (
    <aside role="note" className={className} style={isDisease ? diseaseStyle : basicStyle}>
      <p style={paragraphStyle}>{BASE_LINE}</p>
      {isDisease ? <p style={paragraphStyle}>{DOCTOR_LINE}</p> : null}
    </aside>
  );
}
