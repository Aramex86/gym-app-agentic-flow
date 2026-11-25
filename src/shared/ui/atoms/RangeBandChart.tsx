/* shared/ui/atoms/RangeBandChart — dumb, token-styled min-max band chart.
   Layer reason: shared/ui atom (ADR-0001 D5 boundary test) — describable
   without any training domain: bands in, inline SVG out. Zero-dep
   hand-rolled SVG (ADR-0005, no chart package), zero network, colors ONLY
   via var(--…) tokens (ADR-0001 D5). One y-axis, one series — the caller
   names the series in its <figcaption>; the tooltip is the native SVG
   <title>. No data access, no state, imports react types only. */

import type { JSX } from "react";

/** One range band (min–max, optional mean marker). */
export interface RangeBandDatum {
  /** X label, e.g. the bucket start date. */
  label: string;
  /** Band lower edge (kg); >= 0. */
  min: number;
  /** Band upper edge (kg); >= min. */
  max: number;
  /** Optional emphasized marker inside the band (e.g. the weekly mean). */
  mean?: number;
}

export interface RangeBandChartProps {
  /** Bands in display order; empty → renders nothing. */
  bands: readonly RangeBandDatum[];
  /**
   * Accessible name of the chart (role="img"). The caller includes every
   * value — this label is the accessible equivalent of a table view.
   */
  ariaLabel: string;
  /** Unit suffix printed with titles/ticks/direct label, e.g. "kg". */
  unit?: string;
}

/* Fixed viewBox, identical geometry to TrajectoryChart (plan §6.2) — the
   two focus charts align optically because they share one canvas. */
const VIEW_WIDTH = 240;
const VIEW_HEIGHT = 96;
const PAD_LEFT = 34;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 18;
const PLOT_WIDTH = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT; // 196
const PLOT_HEIGHT = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM; // 68
const PLOT_RIGHT = PAD_LEFT + PLOT_WIDTH;
const BASELINE_Y = PAD_TOP + PLOT_HEIGHT;

const tickStyle = {
  fill: "var(--text-muted)",
  fontFamily: "var(--font-metric)",
  fontSize: 8,
} as const;

// WHY the font shorthand: csstype types fontWeight as a closed union and
// rejects `var(--…)`; `font` accepts arbitrary strings (StatCard pattern).
const valueStyle = {
  fill: "var(--text-high)",
  fontFamily: "var(--font-metric)",
  fontSize: 9,
  fontWeight: 600,
} as const;

/** `12 kg` / `12` — one place for the unit suffix join. */
function unitSuffix(unit: string | undefined): string {
  return unit ? ` ${unit}` : "";
}

/**
 * Renders a single-series min–max band chart (vertical range rectangles
 * with an optional mean marker) as an inline SVG: y min/max ticks, one
 * direct label on the last mean, native <title> tooltip per band.
 * @param props Bands, accessible name, optional unit suffix.
 * @returns The SVG chart, or null for zero bands (nothing to draw).
 * @remarks Do not use for multi-series data — there is no legend; the
 *   caller's figcaption names the single series.
 */
export function RangeBandChart(props: RangeBandChartProps): JSX.Element | null {
  const { bands, ariaLabel, unit } = props;
  if (bands.length === 0) return null;

  // Y-domain over ALL band edges (plan §6.2); means sit inside the bands.
  const edges = bands.flatMap((band) => [band.min, band.max]);
  const rawMin = Math.min(...edges);
  const rawMax = Math.max(...edges);
  const pad = rawMax === rawMin ? 1 : (rawMax - rawMin) * 0.1;
  const yMin = Math.max(0, rawMin - pad);
  const yMax = rawMax + pad;

  // WHY linear map from the padded domain: gridlines/labels share it.
  const y = (value: number): number =>
    PAD_TOP + (1 - (value - yMin) / (yMax - yMin)) * PLOT_HEIGHT;
  // WHY: the 10% pad yields stray decimals (256.4) — ticks round to the
  // same 1-decimal convention as the data (plan §1 rounding).
  const tick = (value: number): number => Math.round(value * 10) / 10;
  // X slots: one band → plot centre; otherwise evenly spread 0..1.
  const x = (index: number): number =>
    bands.length === 1
      ? PAD_LEFT + PLOT_WIDTH / 2
      : PAD_LEFT + (index / (bands.length - 1)) * PLOT_WIDTH;
  // Band width: capped so wide plots never draw slab-wide bands (plan §6.2).
  const bandWidth = Math.min(18, (PLOT_WIDTH / bands.length) * 0.5);

  const last = bands[bands.length - 1]!;
  const lastIndex = bands.length - 1;
  // Direct label sits above the last mean marker, right-anchored, clamped
  // inside the viewBox so the text never spills past the SVG edge.
  const labelX = Math.min(x(lastIndex) + 8, VIEW_WIDTH - 2);
  const labelY = Math.max(y(last.mean ?? last.max) - 8, PAD_TOP + 10);

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      role="img"
      aria-label={ariaLabel}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* Grid: top edge + baseline only (plan §6.1/§6.2 — shared canvas). */}
      <line
        x1={PAD_LEFT}
        y1={PAD_TOP}
        x2={PLOT_RIGHT}
        y2={PAD_TOP}
        strokeWidth={1}
        style={{ stroke: "var(--edge)" }}
      />
      <line
        x1={PAD_LEFT}
        y1={BASELINE_Y}
        x2={PLOT_RIGHT}
        y2={BASELINE_Y}
        strokeWidth={1}
        style={{ stroke: "var(--edge)" }}
      />
      {bands.map((band, index) => {
        const top = y(band.max);
        const bottom = y(band.min);
        return (
          <rect
            key={`${band.label}-${index}`}
            data-testid="range-band"
            x={x(index) - bandWidth / 2}
            y={top}
            width={bandWidth}
            /* WHY max(bottom, 0): a collapsed band (min === max) still
               renders a (zero-height) rect — plan §6.2 pins the mark. */
            height={Math.max(bottom - top, 0)}
            rx={4}
            fillOpacity={0.2}
            strokeWidth={1}
            style={{ fill: "var(--accent-teal)", stroke: "var(--accent-teal)" }}
          >
            <title>
              {`${band.label}: ${band.min}${unitSuffix(unit)}–${band.max}${unitSuffix(unit)}${band.mean !== undefined ? ` (avg ${band.mean}${unitSuffix(unit)})` : ""}`}
            </title>
          </rect>
        );
      })}
      {bands.map((band, index) =>
        band.mean === undefined ? null : (
          <circle
            key={`${band.label}-mean-${index}`}
            data-testid="range-mean"
            cx={x(index)}
            cy={y(band.mean)}
            r={4}
            strokeWidth={2}
            style={{ fill: "var(--accent-teal)", stroke: "var(--surface)" }}
          >
            <title>
              {`${band.label}: avg ${band.mean}${unitSuffix(unit)}`}
            </title>
          </circle>
        ),
      )}
      {/* Y min/max ticks at the left edge, end-anchored (plan §6.1). */}
      <text x={PAD_LEFT - 6} y={y(yMax) + 3} textAnchor="end" style={tickStyle}>
        {tick(yMax)}
      </text>
      <text x={PAD_LEFT - 6} y={y(yMin) + 3} textAnchor="end" style={tickStyle}>
        {tick(yMin)}
      </text>
      {bands.map((band, index) => (
        <text
          key={`${band.label}-label-${index}`}
          x={x(index)}
          y={VIEW_HEIGHT - 4}
          textAnchor="middle"
          style={tickStyle}
        >
          {band.label}
        </text>
      ))}
      <text
        data-testid="range-value"
        x={labelX}
        y={labelY}
        textAnchor="end"
        style={valueStyle}
      >
        {`${last.mean ?? last.max}${unitSuffix(unit)}`}
      </text>
    </svg>
  );
}
