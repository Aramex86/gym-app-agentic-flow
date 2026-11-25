/* shared/ui/atoms/TrajectoryChart — dumb, token-styled line trajectory.
   Layer reason: shared/ui atom (ADR-0001 D5 boundary test) — describable
   without any training domain: points in, inline SVG out. Zero-dep
   hand-rolled SVG (ADR-0005, no chart package), zero network, colors ONLY
   via var(--…) tokens (ADR-0001 D5). One y-axis, one series — the caller
   names the series in its <figcaption>; the tooltip is the native SVG
   <title>. No data access, no state, imports react types only. */

import type { JSX } from "react";

/** One point of a trajectory line. */
export interface TrajectoryPoint {
  /** X label, e.g. the bucket start date "2026-11-06". */
  label: string;
  /** Numeric value (> 0 for e1RM; atom does not enforce any domain). */
  value: number;
}

export interface TrajectoryChartProps {
  /** Points in display order; empty → renders nothing. */
  points: readonly TrajectoryPoint[];
  /**
   * Accessible name of the chart (role="img"). The caller includes every
   * value — this label is the accessible equivalent of a table view.
   */
  ariaLabel: string;
  /** Unit suffix printed with ticks/direct label, e.g. "kg". */
  unit?: string;
}

/* Fixed viewBox (plan §6): font sizes are viewBox units, so text scales
   with the chart while `width: 100%` keeps it responsive. */
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

/**
 * Renders a single-series line chart (points + connecting polyline) as an
 * inline SVG: y min/max ticks, one direct label on the last point, native
 * <title> tooltip per point.
 * @param props Points, accessible name, optional unit suffix.
 * @returns The SVG chart, or null for zero points (nothing to draw).
 * @remarks Do not use for multi-series data — there is no legend; the
 *   caller's figcaption names the single series.
 */
export function TrajectoryChart(props: TrajectoryChartProps): JSX.Element | null {
  const { points, ariaLabel, unit } = props;
  if (points.length === 0) return null;

  // Y-domain: equal values get a ±1 window, otherwise a 10% span pad —
  // always anchored at >= 0 so a single low point does not clip (plan §6.1).
  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = rawMax === rawMin ? 1 : (rawMax - rawMin) * 0.1;
  const yMin = Math.max(0, rawMin - pad);
  const yMax = rawMax + pad;

  // WHY linear map from the padded domain: gridlines/labels share it.
  const y = (value: number): number =>
    PAD_TOP + (1 - (value - yMin) / (yMax - yMin)) * PLOT_HEIGHT;
  // WHY: the 10% pad yields stray decimals (100.76) — ticks round to the
  // same 1-decimal convention as the data (plan §1 rounding).
  const tick = (value: number): number => Math.round(value * 10) / 10;
  // X slots: one point → plot centre; otherwise evenly spread 0..1.
  const x = (index: number): number =>
    points.length === 1
      ? PAD_LEFT + PLOT_WIDTH / 2
      : PAD_LEFT + (index / (points.length - 1)) * PLOT_WIDTH;

  const last = points[points.length - 1]!;
  const lastX = x(points.length - 1);
  const lastY = y(last.value);
  // Direct label sits above the point, right-anchored, clamped inside the
  // viewBox so the text never spills past the SVG edge.
  const labelX = Math.min(lastX + 8, VIEW_WIDTH - 2);
  const labelY = Math.max(lastY - 8, PAD_TOP + 10);

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      role="img"
      aria-label={ariaLabel}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* Grid: top edge + baseline only (plan §6.1 — no vertical grid). */}
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
      {points.length >= 2 ? (
        <polyline
          points={points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ")}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: "var(--accent-volt)" }}
        />
      ) : null}
      {points.map((point, index) => (
        <circle
          key={`${point.label}-${index}`}
          data-testid="trajectory-point"
          cx={x(index)}
          cy={y(point.value)}
          r={4}
          strokeWidth={2}
          style={{ fill: "var(--accent-volt)", stroke: "var(--surface)" }}
        >
          <title>
            {`${point.label}: ${point.value}${unit ? ` ${unit}` : ""}`}
          </title>
        </circle>
      ))}
      {/* Y min/max ticks at the left edge, end-anchored (plan §6.1). */}
      <text x={PAD_LEFT - 6} y={y(yMax) + 3} textAnchor="end" style={tickStyle}>
        {tick(yMax)}
      </text>
      <text x={PAD_LEFT - 6} y={y(yMin) + 3} textAnchor="end" style={tickStyle}>
        {tick(yMin)}
      </text>
      {points.map((point, index) => (
        <text key={`${point.label}-label-${index}`} x={x(index)} y={VIEW_HEIGHT - 4} textAnchor="middle" style={tickStyle}>
          {point.label}
        </text>
      ))}
      {/* Direct label sits above the last point, right-anchored, clamped
          inside the viewBox so the text never spills past the SVG edge. */}
      <text
        data-testid="trajectory-value"
        x={labelX}
        y={labelY}
        textAnchor="end"
        style={valueStyle}
      >
        {`${last.value}${unit ? ` ${unit}` : ""}`}
      </text>
    </svg>
  );
}
