/* shared/ui/atoms/Badge — dumb, token-styled pill for short labels.
   Layer reason: shared/ui atoms must stay domain-free (ADR-0001 D5) —
   the caller supplies the label (e.g. a feature passes "PR") and the tone;
   this atom knows nothing about training. Styling: tokens only. */

import type { JSX } from "react";

export type BadgeTone = "volt" | "teal" | "amber" | "muted";

export interface BadgeProps {
  /** Visible short label, e.g. "PR". Keep it to one or two characters. */
  label: string;
  /** Color role of the pill; maps 1:1 to an accent token. Default "volt". */
  tone?: BadgeTone;
  /** Native tooltip / accessible detail rendered via title + aria-label. */
  title?: string;
}

const TONE_COLOR: Record<BadgeTone, string> = {
  volt: "var(--accent-volt)",
  teal: "var(--accent-teal)",
  amber: "var(--accent-amber)",
  muted: "var(--text-muted)",
} as const;

const pillStyle = {
  display: "inline-block",
  padding: "var(--sp-xs) var(--sp-sm)",
  background: "var(--surface-lifted)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-pill)",
  font: "var(--label-caps)",
  textTransform: "uppercase",
} as const;

/**
 * Renders a token-styled pill with a short label.
 * @param props Label, tone color role, optional tooltip/title detail.
 * @returns Inline, non-interactive pill markup.
 * @remarks Do not use for long text or interactive toggles; this is a label.
 */
export function Badge({ label, tone = "volt", title }: BadgeProps): JSX.Element {
  // WHY: the color role comes from a token map, never from a literal — the
  // value shown to color-blind/AT users is `title`, not the hue.
  return (
    <span
      style={{ ...pillStyle, color: TONE_COLOR[tone] }}
      title={title}
      aria-label={title ?? undefined}
    >
      {label}
    </span>
  );
}
