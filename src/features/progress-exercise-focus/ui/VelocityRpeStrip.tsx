/* features/progress-exercise-focus/ui/VelocityRpeStrip — feature-local
   strip: strip header + mean velocity + up to VelocitySetTile instances.
   Layer reason: features/ui scenario composition — presentational only
   (no data access, no fetch), tokens only (ADR-0001 D5). Renders its
   header + honest empty state when no per-set samples exist (plan A3: no
   fabricated tiles/values); lights up when a real per-set source lands. */

import type { JSX } from "react";
import { VelocitySetTile } from "./VelocitySetTile";

/** One per-set sample handed to the strip (all real data, or absent). */
export interface VelocitySetSample {
  setNumber: number;
  velocityMps?: number;
  rpe?: number;
  top?: boolean;
}

export interface VelocityRpeStripProps {
  /** Strip title, e.g. "Latest Velocity & RPE Profile" (also aria-label). */
  title: string;
  /** Mean readout label, e.g. "Mean". */
  meanLabel: string;
  /** Mean velocity in m/s; undefined → "Ø —" (honest missing value). */
  meanVelocityMps?: number;
  /** Per-set samples; empty → the empty copy, ZERO tiles. */
  sets: readonly VelocitySetSample[];
  /** Shown when sets is empty, e.g. the not-yet-captured copy. */
  emptyLabel: string;
}

const stripStyle = {
  background: "var(--srf-container-high)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-card)",
  padding: "var(--sp-sm)",
  display: "grid",
  gap: "var(--sp-sm)",
} as const;

const headerStyle = {
  display: "flex",
  alignItems: "baseline",
  gap: "var(--sp-sm)",
} as const;

const titleStyle = {
  margin: 0,
  font: "var(--label-caps)",
  color: "var(--text-high)",
} as const;

/** `Ø 0.62 m/s` / `Ø —` — the engineering Ø always marks a mean. */
function formatMean(meanVelocityMps: number | undefined): string {
  if (meanVelocityMps === undefined) return "Ø —";
  return `Ø ${meanVelocityMps.toFixed(2)} m/s`;
}

const meanStyle = {
  color: "var(--accent-teal)",
  fontFamily: "var(--font-metric)",
} as const;

const emptyStyle = {
  margin: 0,
  color: "var(--text-muted)",
} as const;

/**
 * Renders the velocity/RPE strip: title + mean in a header row, then one
 * VelocitySetTile instance per sample; with NO samples only the header and
 * the empty copy render — no tiles, no velocity numbers.
 * @param props Title/labels, optional mean, samples, empty copy.
 * @returns The strip section.
 * @remarks Pass real samples only; an empty `sets` is the honest state
 *   until a per-set source exists in the entity (plan A3).
 */
export function VelocityRpeStrip(props: VelocityRpeStripProps): JSX.Element {
  const { title, meanLabel, meanVelocityMps, sets, emptyLabel } = props;
  return (
    <section aria-label={title} style={stripStyle}>
      <header style={headerStyle}>
        <h5 style={titleStyle}>{title}</h5>
        <span style={{ color: "var(--text-muted)" }}>{meanLabel}</span>
        <span style={meanStyle}>{formatMean(meanVelocityMps)}</span>
      </header>
      {sets.length === 0 ? (
        // WHY no tiles here: fabricating S1–S4 placeholders would present
        // invented data — the empty copy is the honest state (plan A3).
        <p style={emptyStyle}>{emptyLabel}</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
            gap: "var(--sp-sm)",
          }}
        >
          {sets.map((sample) => (
            // ONE component, N instances — never four copied components.
            <VelocitySetTile key={sample.setNumber} {...sample} />
          ))}
        </div>
      )}
    </section>
  );
}
