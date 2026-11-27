/* features/progress-exercise-focus/ui/ChartLegend — feature-local swatch
   legend for the combined focus chart. Layer reason: features/ui scenario
   composition — presentational only (no data access, no fetch), tokens
   only (ADR-0001 D5). Kept feature-local (not a shared atom) because its
   swatch pair + peak label are specific to the focus-card slice. */

import type { JSX } from "react";

export interface ChartLegendProps {
  /** Label of the line series, e.g. "1RM Trajectory". */
  lineLabel: string;
  /** Label of the bar series, e.g. "Volume (Sets × Load)". */
  barLabel: string;
  /** e.g. "Peak: 122.5 kg e1RM"; omitted when no point exists. */
  peakLabel?: string;
}

/* Swatches are aria-hidden: their meaning is carried by the text labels. */
const lineSwatchStyle = {
  width: 16,
  height: 2,
  background: "var(--accent-volt)",
} as const;

const barSwatchStyle = {
  width: 8,
  height: 8,
  background: "var(--accent-teal)",
} as const;

const legendRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "var(--sp-sm)",
  font: "var(--label-caps)",
  color: "var(--text-muted)",
} as const;

/**
 * Renders the chart's swatch legend: a volt line swatch + line label, a
 * teal bar swatch + bar label, and an optional right-aligned peak label.
 * @param props Two series labels + optional peak text.
 * @returns The legend row.
 * @remarks Presentational only — pass the peak text ready-made via
 *   peakLabel; nothing is derived here.
 */
export function ChartLegend(props: ChartLegendProps): JSX.Element {
  return (
    <div style={legendRowStyle}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-xs)" }}>
        <span aria-hidden="true" style={lineSwatchStyle} />
        {props.lineLabel}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-xs)" }}>
        <span aria-hidden="true" style={barSwatchStyle} />
        {props.barLabel}
      </span>
      {props.peakLabel ? (
        // Right-aligned metric chip — the only high-contrast ink on the row.
        <span style={{ color: "var(--text-high)", marginInlineStart: "auto" }}>
          {props.peakLabel}
        </span>
      ) : null}
    </div>
  );
}
