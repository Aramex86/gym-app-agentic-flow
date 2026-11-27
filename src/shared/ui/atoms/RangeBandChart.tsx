/* shared/ui/atoms/RangeBandChart — dumb, token-styled min–max band chart.
   Layer reason: shared/ui atom (ADR-0001 D5 boundary test) — describable
   without any training domain: bands in, chart out. Rendering is delegated
   to recharts (plan v2 §4): mean bars + an ErrorBar whisker per band, one
   y-axis, one series — the caller names the series in its <figcaption>.
   Zero network, colors ONLY via var(--…) tokens (ADR-0001 D5). No data
   access, no state. */

import type { JSX } from "react";
import {
  ComposedChart,
  Bar,
  CartesianGrid,
  ErrorBar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { BarShapeProps } from "recharts";

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

/* Fixed pixel canvas — identical geometry intent to TrajectoryChart (plan
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

/* The chart-local data row: mean (bar top) + the ErrorBar whisker offsets.
   WHY the title rides along: recharts owns the tooltip, so the per-band
   native <title> (plan §4 — a missing mean keeps the tooltip text the
   same) is carried by the custom bar shape via this field. */
interface BandPoint {
  label: string;
  /** Bar top (kg); the band midpoint when the caller gave no mean. */
  mean: number;
  /** [mean - min, max - mean] — ErrorBar offsets landing on the band edges. */
  bandError: [number, number];
  /** The pre-format band tooltip: `label: min–max (avg mean)`. */
  title: string;
}

/**
 * Maps the public band data to chart-local points, formatting the per-band
 * tooltip title exactly as the hand-rolled SVG <title> did. A missing mean
 * is positioned at the band midpoint while the whisker still spans
 * min–max (plan v2 §4).
 */
function toBandPoints(
  bands: readonly RangeBandDatum[],
  unit: string | undefined,
): BandPoint[] {
  return bands.map((band) => {
    const mean = band.mean ?? (band.min + band.max) / 2;
    return {
      label: band.label,
      mean,
      bandError: [mean - band.min, band.max - mean],
      title: `${band.label}: ${band.min}${unitSuffix(unit)}–${band.max}${unitSuffix(unit)}${band.mean !== undefined ? ` (avg ${band.mean}${unitSuffix(unit)})` : ""}`,
    };
  });
}

/**
 * Custom recharts Bar shape: one teal marker rectangle per band, carrying
 * the native <title> tooltip (plan v2 §4 — data-testid="range-mean" on the
 * Bar; the marker IS the Bar). Collapsed bands (min === max) render a
 * zero-height rect — the plan §6.2 pin keeps the mark in the DOM.
 */
function MeanBarShape(props: BarShapeProps): JSX.Element {
  const { x, y, width, height, payload } = props;
  return (
    <rect
      data-testid="range-mean"
      x={x}
      y={y}
      width={width}
      /* WHY max(height, 0): a collapsed band (min === max) still renders a
         (zero-height) rect — plan §6.2 pins the mark. */
      height={Math.max(height, 0)}
      rx={4}
      fill="var(--accent-teal)"
      fillOpacity={0.2}
      strokeWidth={1}
      stroke="var(--accent-teal)"
    >
      <title>{payload.title}</title>
    </rect>
  );
}

/**
 * Custom recharts tooltip content: renders only the row's pre-format
 * `min–max (avg mean)` title in a token-styled box.
 * WHY a custom content component: the bare recharts default tooltip is
 * light-themed AND would leak the internal `bandError` whisker offsets
 * (e.g. `[2100, 2560]`) as a raw row — both are hidden here; the visible
 * text stays the same format the native <title> already carries.
 */
interface BandTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: BandPoint }>;
}

function BandTooltip({ active, payload }: BandTooltipProps): JSX.Element | null {
  if (!active || !payload?.length) return null;
  return (
    <div data-testid="range-tooltip" style={tooltipBoxStyle}>
      {payload[0]!.payload.title}
    </div>
  );
}

/**
 * Renders a single-series min–max band chart (per-band mean bars with
 * min–max ErrorBar whiskers) via recharts: y min/max ticks, one direct
 * HTML label on the last mean, per-band native <title> tooltip.
 * @param props Bands, accessible name, optional unit suffix.
 * @returns The chart figure, or null for zero bands (nothing to draw).
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

  // WHY: the 10% pad yields stray decimals (256.4) — ticks round to the
  // same 1-decimal convention as the data (plan §1 rounding).
  const formatTick = (value: number): string => `${Math.round(value * 10) / 10}`;

  const bandPoints = toBandPoints(bands, unit);
  // The direct label shows the caller's own last mean/max — NOT the
  // midpoint-substituted chart row (plan v2 §4: `${last.mean ?? last.max}`),
  // so a missing mean keeps reporting the band upper edge.
  const lastBand = bands[bands.length - 1]!;

  return (
    <figure
      data-testid="range-band"
      role="img"
      aria-label={ariaLabel}
      style={{ margin: 0, position: "relative" }}
    >
      <ComposedChart
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        data={bandPoints}
        margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
      >
        {/* Grid: min/max lines only (plan §6.1/§6.2 — no busy grid). */}
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
        <Tooltip
          content={<BandTooltip />}
          cursor={{ fill: "var(--surface-lifted)" }}
        />
        <Bar
          dataKey="mean"
          fill="var(--accent-teal)"
          fillOpacity={0.2}
          shape={MeanBarShape}
          isAnimationActive={false}
        >
          {/* WHY nested: recharts requires ErrorBar to be a child of a
              graphical element (plan v2 §4 — direction y whiskers span
              min–max around the bar top). */}
          <ErrorBar
            dataKey="bandError"
            direction="y"
            strokeWidth={1}
            stroke="var(--accent-teal)"
            isAnimationActive={false}
          />
        </Bar>
      </ComposedChart>
      {/* Direct label sits at the chart's right edge — an HTML span over
          the SVG (plan v2 §4 direct-label element). */}
      <span
        data-testid="range-value"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          ...valueStyle,
        }}
      >
        {`${lastBand.mean ?? lastBand.max}${unitSuffix(unit)}`}
      </span>
    </figure>
  );
}
