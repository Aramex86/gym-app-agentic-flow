/* shared/ui/atoms/TrajectoryChart — dumb, token-styled line trajectory.
   Layer reason: shared/ui atom (ADR-0001 D5 boundary test) — describable
   without any training domain: points in, chart out. Rendering is
   delegated to recharts (plan v2 §3): a linear line with a dot per
   populated bucket (connectNulls={false} — no invented shape, no filled
   gaps), one y-axis, one series — the caller names the series in its
   <figcaption>. Zero network, colors ONLY via var(--…) tokens (ADR-0001
   D5). No data access, no state. */

import type { JSX } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

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
  /** Unit suffix printed with tick titles/direct label, e.g. "kg". */
  unit?: string;
}

/* Fixed pixel canvas — identical geometry intent to RangeBandChart (plan
   §6.2 shared canvas); recharts draws an SVG of exactly this size under a
   100%-wide wrapper, so the two focus charts still align optically. */
const CHART_WIDTH = 240;
const CHART_HEIGHT = 96;

const axisTickStyle = {
  fill: "var(--text-muted)",
  fontFamily: "var(--font-metric)",
  fontSize: 8,
} as const;

/* Hover tooltip box recharts would otherwise draw light-themed (white box)
   over the dark Kinetic Obsidian surface — every value is a token. */
const tooltipBoxStyle = {
  background: "var(--surface-lifted)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-card)",
  color: "var(--text-high)",
  font: "11px var(--font-metric)",
  padding: "var(--sp-xs) var(--sp-sm)",
} as const;

// WHY the font shorthand: csstype types fontWeight as a closed union and
// rejects `var(--…)`; plain style objects accept arbitrary strings
// (StatCard pattern).
const valueStyle = {
  color: "var(--text-high)",
  fontFamily: "var(--font-metric)",
  fontSize: 9,
  fontWeight: 600,
} as const;

/** `12 kg` / `12` — one place for the unit suffix join. */
function unitSuffix(unit: string | undefined): string {
  return unit ? ` ${unit}` : "";
}

/* Props recharts injects into a custom Line dot renderer. */
interface LineDotProps {
  cx?: number | null;
  cy?: number | null;
  /** The mapped trajectory data row (label/value). */
  payload: TrajectoryPoint;
}

/**
 * Builds the custom recharts dot renderer (closure over the unit): one
 * volt circle per populated bucket, carrying the native <title> tooltip
 * (plan v2 §3 — data-testid="trajectory-point" per mark).
 */
function makeTrajectoryDot(unit: string | undefined): (props: LineDotProps) => JSX.Element {
  return (dotProps) => (
    <circle
      data-testid="trajectory-point"
      cx={dotProps.cx ?? undefined}
      cy={dotProps.cy ?? undefined}
      r={4}
      strokeWidth={2}
      fill="var(--accent-volt)"
      stroke="var(--surface)"
    >
      <title>
        {`${dotProps.payload.label}: ${dotProps.payload.value}${unitSuffix(unit)}`}
      </title>
    </circle>
  );
}

/**
 * Renders a single-series line chart (points + connecting line) via
 * recharts: y min/max ticks, one direct HTML label on the last point,
 * per-point native <title> tooltip.
 * @param props Points, accessible name, optional unit suffix.
 * @returns The chart figure, or null for zero points (nothing to draw).
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

  // WHY: the 10% pad yields stray decimals (100.76) — ticks round to the
  // same 1-decimal convention as the data (plan §1 rounding).
  const formatTick = (value: number): string => `${Math.round(value * 10) / 10}`;

  const last = points[points.length - 1]!;

  return (
    <figure
      role="img"
      aria-label={ariaLabel}
      style={{ margin: 0, position: "relative" }}
    >
      <LineChart
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        data={points}
        margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
      >
        {/* Grid: min/max lines only (plan §6.1 — no vertical grid). */}
        <CartesianGrid
          stroke="var(--edge)"
          vertical={false}
          horizontalPoints={[yMin, yMax]}
        />
        <XAxis
          dataKey="label"
          interval={0}
          tickLine={false}
          axisLine={false}
          tick={axisTickStyle}
        />
        <YAxis
          domain={[yMin, yMax]}
          tickFormatter={formatTick}
          tickLine={false}
          axisLine={false}
          tick={axisTickStyle}
          width={34}
        />
        {/* WHY the raw formatter param: recharts' ValueType is wider than
            number — annotating it `number` fails under strictFunctionTypes. */}
        <Tooltip
          cursor={{ stroke: "var(--edge)" }}
          contentStyle={tooltipBoxStyle}
          labelStyle={{ color: "var(--text-muted)" }}
          itemStyle={{ color: "var(--text-high)" }}
          formatter={(value) => `${value}${unitSuffix(unit)}`}
        />
        {/* WHY linear + connectNulls={false}: the data law — one segment
            per populated week pair, no smoothing, no filled gaps (plan
            v2 §3, plan §1). */}
        <Line
          type="linear"
          dataKey="value"
          stroke="var(--accent-volt)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={makeTrajectoryDot(unit)}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
      {/* Direct label sits at the chart's right edge — an HTML span over
          the SVG (plan v2 §4 direct-label element pattern). */}
      <span
        data-testid="trajectory-value"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          ...valueStyle,
        }}
      >
        {`${last.value}${unitSuffix(unit)}`}
      </span>
    </figure>
  );
}
