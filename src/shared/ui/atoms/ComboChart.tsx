/* shared/ui/atoms/ComboChart — dumb, token-styled dual-series composed
   chart. Layer reason: shared/ui atom (ADR-0001 D5 boundary test) —
   describable without any training domain: (bar, line) value pairs in, one
   recharts ComposedChart out; the caller formats the x tick labels and the
   accessible name. Rendering is delegated to recharts (ADR-0011 — charts
   use recharts, hand-rolled SVG is forbidden): teal Bar at the BACK (paint
   order = z-order: Bar → Area → Line), volt Area + Line + dots for the
   second series, horizontal grid, token-styled tooltip + native <title>
   marks. Zero network, colors ONLY via var(--…) tokens, imports only
   react + recharts (ADR-0005). Fixed 300 × 170 canvas — NOT a
   ResponsiveContainer, which measures 0 × 0 in jsdom (plan A7). No data
   access, no state. */

import type { JSX } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** One row of the combo chart. */
export interface ComboChartPoint {
  /** X tick label, e.g. "WK44" (caller formats; atom is domain-free). */
  label: string;
  /** Volume bar (first/left scale); null → no bar at this tick (anchor row). */
  barValue: number | null;
  /** 1RM line + area (second/right scale); null → no mark at this tick. */
  lineValue: number | null;
}

export interface ComboChartProps {
  /** Rows in display order; empty (or all-null values) → renders nothing. */
  points: readonly ComboChartPoint[];
  /**
   * Accessible name of the chart (role="img"). The caller includes EVERY
   * value — this label is the accessible equivalent of a table view.
   */
  ariaLabel: string;
  /** Series display name for the tooltip row prefix, e.g. "Volume". */
  barName?: string;
  lineName?: string;
  /** Unit suffix printed with values in tooltips/titles, e.g. "kg". */
  barUnit?: string;
  lineUnit?: string;
}

/* Fixed pixel canvas (plan A7): same convention as TrajectoryChart /
   RangeBandChart (fixed-canvas atoms at 240 × 96) — recharts draws an SVG
   of exactly this size under a 100%-wide figure. */
const CHART_WIDTH = 300;
const CHART_HEIGHT = 170;

const axisTickStyle = {
  fill: "var(--text-muted)",
  fontFamily: "var(--font-metric)",
  fontSize: 8,
} as const;

/* Props recharts injects into a custom Bar `shape` renderer. `y`/`height`
   are optional because a null bar value (anchor row) gets no geometry. */
interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** The mapped chart row (label/barValue/lineValue). recharts marks it
      optional on its own BarShapeProps — guard before use. */
  payload?: ComboChartPoint;
}

/**
 * Builds the custom recharts Bar shape (closure over the unit): a 2
 * px-rounded teal rect carrying the native <title> tooltip. A null bar
 * value (anchor row) draws nothing — no mark, no title.
 */
function makeComboBarShape(barUnit: string | undefined): (props: BarShapeProps) => JSX.Element {
  const unit = barUnit ? ` ${barUnit}` : "";
  return (shapeProps) => {
    const { x, y, width, height, payload } = shapeProps;
    // WHY: plan Step 2 — null barValue → empty <g /> (no mark, no title).
    if (!payload || payload.barValue === null || x === undefined || width === undefined) {
      return <g />;
    }
    return (
      <g data-testid="combo-bar">
        <rect
          x={x}
          y={y ?? 0}
          width={width}
          height={height ?? 0}
          rx={2}
          fill="var(--accent-teal)"
          fillOpacity={0.35}
        >
          <title>{`${payload.label}: ${payload.barValue}${unit} volume`}</title>
        </rect>
      </g>
    );
  };
}

/* Props recharts injects into a custom Line dot renderer. */
interface LineDotProps {
  cx?: number | null;
  cy?: number | null;
  /** The mapped chart row (label/barValue/lineValue). */
  payload: ComboChartPoint;
}

/**
 * Builds the custom recharts Line dot renderer (closure over the unit):
 * one volt circle per populated line tick, carrying the native <title>
 * tooltip (data-testid="combo-point" per mark).
 */
function makeComboDot(lineUnit: string | undefined): (props: LineDotProps) => JSX.Element {
  const unit = lineUnit ? ` ${lineUnit}` : "";
  return (dotProps) => (
    <circle
      data-testid="combo-point"
      cx={dotProps.cx ?? undefined}
      cy={dotProps.cy ?? undefined}
      r={4}
      strokeWidth={2}
      fill="var(--accent-volt)"
      stroke="var(--surface)"
    >
      <title>{`${dotProps.payload.label}: ${dotProps.payload.lineValue}${unit} 1RM`}</title>
    </circle>
  );
}

/* Row of the recharts-injected tooltip payload the custom content reads.
   Minimal shape on purpose: recharts' full TooltipContentProps is wider. */
interface TooltipEntry {
  /** The series dataKey ("barValue" / "lineValue"). */
  dataKey?: string | number;
  /** Series value; null/undefined rows are hidden (plan: non-null only). */
  value?: number | string | null;
}

interface ComboTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: readonly TooltipEntry[];
  /** Row prefixes + unit suffixes, re-injected via the content element. */
  barName?: string;
  lineName?: string;
  barUnit?: string;
  lineUnit?: string;
}

/** `2500 kg` / `2500` — one place for the unit suffix join. */
function withUnit(value: number, unit: string | undefined): string {
  return unit ? `${value} ${unit}` : `${value}`;
}

/**
 * Token-styled custom tooltip: lists ONLY non-null rows
 * ("Volume: 2500 kg", "1RM: 116.7 kg"), box in --surface-lifted/--edge.
 */
function ComboTooltip(tooltipProps: ComboTooltipProps): JSX.Element | null {
  const { active, label, payload, barName, lineName, barUnit, lineUnit } = tooltipProps;
  if (!active || !payload || payload.length === 0) return null;

  const rows: string[] = [];
  for (const entry of payload) {
    if (entry.value === null || entry.value === undefined) continue;
    if (entry.dataKey === "barValue") {
      rows.push(`${barName ?? "Volume"}: ${withUnit(Number(entry.value), barUnit)}`);
    } else if (entry.dataKey === "lineValue") {
      rows.push(`${lineName ?? "1RM"}: ${withUnit(Number(entry.value), lineUnit)}`);
    }
  }
  if (rows.length === 0) return null;

  return (
    <div
      data-testid="combo-tooltip"
      style={{
        background: "var(--surface-lifted)",
        border: "1px solid var(--edge)",
        borderRadius: "var(--r-card)",
        color: "var(--text-high)",
        font: "11px var(--font-metric)",
        padding: "var(--sp-xs) var(--sp-sm)",
      }}
    >
      {/* Label ink is muted (same roles as the default recharts box). */}
      <div style={{ color: "var(--text-muted)" }}>{label}</div>
      {rows.map((row) => (
        <div key={row}>{row}</div>
      ))}
    </div>
  );
}

/**
 * Renders one combined two-series chart via recharts: volume bars at the
 * back (first y scale), line + area + dots at the front (second y scale),
 * horizontal grid, caller-supplied tick labels.
 * @param props Rows, accessible name, optional series names/units.
 * @returns The chart figure, or null for zero rows or no usable value
 *   (nothing to draw).
 * @remarks Domain-free by contract: the atom never computes week numbers,
 *   exercise names or deltas — pass ready labels and values only.
 */
export function ComboChart(props: ComboChartProps): JSX.Element | null {
  const { points, ariaLabel, barName, lineName, barUnit, lineUnit } = props;

  const hasBar = points.some((point) => point.barValue !== null);
  const hasLine = points.some((point) => point.lineValue !== null);
  if (points.length === 0 || (!hasBar && !hasLine)) return null;

  // Volume scale starts at 0 and is padded 15% above the tallest bar so a
  // full-height bar does not kiss the top canvas edge; [0, 1] when there
  // are no bars at all (the scale still exists for the hidden grid lines).
  const barValues = points
    .map((point) => point.barValue)
    .filter((value): value is number => value !== null);
  const volumeDomain: [number, number] = hasBar
    ? [0, Math.max(...barValues) * 1.15]
    : [0, 1];

  // Line scale: 10% pad around min/max (same rule as TrajectoryChart),
  // never below 0 so a low single point does not clip.
  const lineValues = points
    // WHY the non-null filter at both ends: equal values get a ±1 window.
    .map((point) => point.lineValue)
    .filter((value): value is number => value !== null);
  const lineDomain: [number, number] = hasLine
    ? (() => {
        const rawMin = Math.min(...lineValues);
        const rawMax = Math.max(...lineValues);
        const pad = rawMax === rawMin ? 1 : (rawMax - rawMin) * 0.1;
        return [Math.max(0, rawMin - pad), rawMax + pad] as [number, number];
      })()
    : [0, 1];

  return (
    <figure role="img" aria-label={ariaLabel} data-testid="combo-chart" style={{ margin: 0 }}>
      <ComposedChart
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        data={points}
        margin={{ top: 10, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid stroke="var(--edge)" vertical={false} />
        <XAxis
          dataKey="label"
          interval={0}
          tickLine={false}
          axisLine={false}
          tick={axisTickStyle}
        />
        {/* Two hidden-scale y-axes (no numeric labels — the mock has none;
            values live in the tooltip, native titles and the aria table). */}
        <YAxis yAxisId="volume" domain={volumeDomain} tick={false} axisLine={false} tickLine={false} width={0} />
        <YAxis yAxisId="line" domain={lineDomain} tick={false} axisLine={false} tickLine={false} width={0} orientation="right" />
        {/* PAINT ORDER == Z-ORDER: Bar first (back), then Area, then Line
            (front) — plan Step 2. Bar/Area/Line are recharts series keys. */}
        <Bar
          dataKey="barValue"
          yAxisId="volume"
          fill="var(--accent-teal)"
          fillOpacity={0.35}
          isAnimationActive={false}
          shape={makeComboBarShape(barUnit)}
        />
        <Area
          dataKey="lineValue"
          yAxisId="line"
          type="linear"
          stroke="none"
          fill="var(--accent-volt)"
          fillOpacity={0.12}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          dataKey="lineValue"
          yAxisId="line"
          type="linear"
          stroke="var(--accent-volt)"
          strokeWidth={2}
          dot={makeComboDot(lineUnit)}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Tooltip
          cursor={{ stroke: "var(--edge)" }}
          content={
            <ComboTooltip barName={barName} lineName={lineName} barUnit={barUnit} lineUnit={lineUnit} />
          }
        />
      </ComposedChart>
    </figure>
  );
}
