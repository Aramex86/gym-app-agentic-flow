/* shared/ui/atoms/Skeleton — dumb, token-styled loading placeholder.
   Layer reason: domain-free primitive; announces loading politely while the
   owner fetches (e.g. the AI review card). Styling: tokens only. */

import type { JSX } from "react";

export interface SkeletonProps {
  /** Accessible name announced while pending; default "Loading". */
  label?: string;
  /** Number of placeholder bars to render; default 3. */
  lines?: number;
}

const barStyle = {
  height: "var(--sp-md)",
  background: "var(--surface-lifted)",
  borderRadius: "var(--r-card)",
} as const;

const stackStyle = {
  display: "grid",
  gap: "var(--sp-sm)",
} as const;

/**
 * Renders a polite status region with placeholder bars.
 * @param props Loading label for assistive tech and the bar count.
 * @returns role="status" region; bars are decoration for AT (aria-hidden).
 * @remarks Do not use for content already visible; remove once data arrives.
 */
export function Skeleton({ label = "Loading", lines = 3 }: SkeletonProps): JSX.Element {
  const lineIndexes = Array.from({ length: lines }, (_, index) => index);
  return (
    <div role="status" aria-live="polite" aria-label={label} style={stackStyle}>
      {lineIndexes.map((index) => (
        <div key={index} style={barStyle} data-testid="skeleton-line" aria-hidden="true" />
      ))}
    </div>
  );
}
