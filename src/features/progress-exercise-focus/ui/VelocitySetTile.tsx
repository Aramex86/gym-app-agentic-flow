/* features/progress-exercise-focus/ui/VelocitySetTile — feature-local tile
   for ONE training set's velocity/RPE readout. Layer reason: features/ui
   scenario composition — presentational only (no data access, no fetch),
   tokens only (ADR-0001 D5). ONE component, rendered as instances via
   .map by VelocityRpeStrip — never copy-paste it per set (plan §4). */

import type { JSX } from "react";

export interface VelocitySetTileProps {
  /** 1-based set index; rendered "S1", "S2", … */
  setNumber: number;
  /** Mean velocity in m/s; undefined → "—" (honest missing value). */
  velocityMps?: number;
  /** Session RPE; undefined → "RPE —" (honest missing value). */
  rpe?: number;
  /** Top-set emphasis: volt ring + glow. */
  top?: boolean;
}

const tileStyle = {
  background: "var(--srf-container-lowest)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-card)",
  padding: "var(--sp-sm)",
  display: "grid",
  gap: "var(--sp-xs)",
} as const;

const setLabelStyle = {
  font: "var(--label-caps)",
  color: "var(--text-muted)",
} as const;

const velocityStyle = {
  color: "var(--text-high)",
  fontFamily: "var(--font-metric)",
} as const;

/** RPE ≥ 8 is the volt "hard set" ink; a present but light set is teal. */
function rpeColor(rpe: number | undefined): string {
  if (rpe === undefined) return "var(--text-muted)";
  return rpe >= 8 ? "var(--accent-volt)" : "var(--accent-teal)";
}

/**
 * Renders one set tile: "S#", velocity ("0.62 m/s" or "—") and RPE
 * ("RPE 8" or "RPE —"); the top set gets a volt ring and glow.
 * @param props Set number + optional velocity/RPE + top flag.
 * @returns The tile card.
 * @remarks Missing values render an explicit placeholder — never a
 *   fabricated number (plan §4: renders only real data).
 */
export function VelocitySetTile(props: VelocitySetTileProps): JSX.Element {
  const { setNumber, velocityMps, rpe, top } = props;
  return (
    <div
      data-testid="velocity-set-tile"
      data-top={top ? "true" : "false"}
      style={{
        ...tileStyle,
        borderColor: top ? "var(--accent-volt)" : "var(--edge)",
        boxShadow: top ? "var(--accent-glow-volt)" : undefined,
      }}
    >
      <span style={setLabelStyle}>{`S${setNumber}`}</span>
      <span style={velocityStyle}>
        {velocityMps === undefined ? "—" : `${velocityMps.toFixed(2)} m/s`}
      </span>
      <span style={{ color: rpeColor(rpe) }}>
        {rpe === undefined ? "RPE —" : `RPE ${rpe}`}
      </span>
    </div>
  );
}
