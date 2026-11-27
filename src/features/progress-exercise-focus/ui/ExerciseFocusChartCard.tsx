/* features/progress-exercise-focus — Exercise focus scenario card for the
   Progress page. Layer reason: features/ui scenario composition; ALL data
   access goes through @entities/session-log selectors (no network of any
   kind here — AGENTS.md data rule) and every color comes from tokens
   (ADR-0001 D5). The single combo chart is the @shared/ui ComboChart atom
   (ADR-0011 — one ComposedChart, no hand-rolled SVG); this feature derives
   the row mapping, the accessible name and copy via ../config/focusChart /
   focusCopy. Renamed from ExerciseFocusCharts (plan A1: same props
   semantics — entries? test seam + onCompose). */

import { useMemo, useState } from "react";
import type { JSX } from "react";
import {
  getSessionLog,
  selectExerciseFocus,
  selectTrackedExercises,
} from "@entities/session-log";
import type { SessionLogEntry } from "@entities/session-log";
import { isComposerAvailable, useComposerStatus } from "@entities/composer";
import {
  Badge,
  Button,
  ChoiceChipGroup,
  ComboChart,
  EmptyState,
} from "@shared/ui";
import type { ChoiceChipOption } from "@shared/ui";
import { FOCUS_COPY, incompleteHint } from "../config/focusCopy";
import {
  buildComboRows,
  comboAriaLabel,
  e1rmDeltaPercent,
  formatDelta,
  latestE1rm,
  peakE1rm,
} from "../config/focusChart";
import { ChartLegend } from "./ChartLegend";
import { VelocityRpeStrip } from "./VelocityRpeStrip";

export interface ExerciseFocusChartCardProps {
  /** Test-only seam; production reads getSessionLog(). */
  entries?: readonly SessionLogEntry[];
  /** Empty-state composer CTA (the page scrolls to the composer). */
  onCompose: () => void;
}

/* Grid gap only — the card chrome (below) moved onto each card so the
   heading belongs to the page grid, not to a boxed section. */
const sectionStyle = {
  display: "grid",
  gap: "var(--sp-sm)",
  padding: "var(--sp-md)",
} as const;

const headingStyle = {
  margin: 0,
  color: "var(--text-high)",
} as const;

/* Card chrome the section used to carry (surface/edge/r-card/sp-md). */
const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-card)",
  padding: "var(--sp-md)",
  display: "grid",
  gap: "var(--sp-sm)",
} as const;

const cardHeaderStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  gap: "var(--sp-sm)",
} as const;

const cardTitleStyle = {
  margin: 0,
  color: "var(--text-high)",
} as const;

const metricBlockStyle = {
  display: "grid",
  gap: "var(--sp-xs)",
  marginInlineStart: "auto",
  justifyItems: "end",
  textAlign: "right",
} as const;

const metricLabelStyle = {
  font: "var(--label-caps)",
  color: "var(--text-muted)",
} as const;

const metricValueStyle = {
  color: "var(--text-high)",
  fontFamily: "var(--font-metric)",
  fontSize: "var(--metric-md-size)",
} as const;

const deltaStyle = {
  color: "var(--accent-teal)",
  fontFamily: "var(--font-metric)",
} as const;

const hintStyle = {
  margin: 0,
  color: "var(--text-muted)",
} as const;

const ctaStyle = {
  justifySelf: "start",
} as const;

/**
 * Renders the per-exercise deep-dive card: exercise chip selector, the
 * card header (exercise name, T1 pill, latest real e1RM + real delta),
 * the series legend, exactly ONE combined chart (1RM line + volume bars)
 * and the velocity/RPE strip; keeps the existing empty state and the
 * composer CTA when nothing is tracked in the window.
 * @param props Optional raw entries override (test seam) + CTA callback.
 * @returns The exercise-focus section.
 * @remarks Header shows the LATEST real e1RM only (plan A2 — no
 *   projected value, no extrapolation); the strip passes sets={[]} (plan
 *   A3 — no per-set velocity/RPE source exists yet), so it renders its
 *   honest empty state until a real source lands.
 */
export function ExerciseFocusChartCard(
  props: ExerciseFocusChartCardProps,
): JSX.Element {
  const source = props.entries ?? getSessionLog();

  const options = useMemo<ChoiceChipOption<string>[]>(
    () =>
      selectTrackedExercises(source).map((exercise) => ({
        id: exercise.exerciseId,
        label: exercise.exerciseName,
      })),
    [source],
  );

  /* WHY no useEffect: the selection defaults to the first option (first
     alphabetically) by derivation, so state only stores an explicit pick. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    options.find((option) => option.id === selectedId)?.id ?? options[0]?.id ?? null;

  const focus = useMemo(
    () => (selected ? selectExerciseFocus(source, selected) : null),
    [source, selected],
  );

  const composerStatus = useComposerStatus();
  const composerOffline = !isComposerAvailable(composerStatus);

  // Presentation mapping is pure (../config/focusChart) — derived per
  // render from the selector output, never from raw sets (AGENTS.md data).
  const rows = useMemo(() => (focus ? buildComboRows(focus) : []), [focus]);
  const latest = focus ? latestE1rm(focus) : null;
  const delta = focus ? e1rmDeltaPercent(focus) : null;
  const peak = focus ? peakE1rm(focus) : null;

  return (
    <section aria-label={FOCUS_COPY.heading} style={sectionStyle}>
      <h3 style={headingStyle}>{FOCUS_COPY.heading}</h3>
      {options.length === 0 || !focus ? (
        <div style={cardStyle}>
          <EmptyState title={FOCUS_COPY.emptyTitle} description={FOCUS_COPY.emptyDescription} />
          <span style={ctaStyle}>
            {/* WHY disabled only when offline: a not-yet-checked composer
                (unknown) must not block the CTA — plan A4 / composerStatus. */}
            <Button variant="primary" onClick={props.onCompose} disabled={composerOffline}>
              {FOCUS_COPY.composerCta}
            </Button>
          </span>
        </div>
      ) : (
        <>
          <ChoiceChipGroup
            legend={FOCUS_COPY.selectorLegend}
            options={options}
            value={selected}
            onChange={setSelectedId}
          />
          <article aria-label={`${focus.exerciseName} focus card`} style={cardStyle}>
            <header style={cardHeaderStyle}>
              <div style={{ display: "grid", gap: "var(--sp-xs)" }}>
                <h4 style={cardTitleStyle}>{focus.exerciseName}</h4>
                {/* Static display copy, not an entity field (plan A6). */}
                <span style={{ justifySelf: "start" }}>
                  <Badge label={FOCUS_COPY.t1Badge} tone="muted" title={FOCUS_COPY.t1BadgeTitle} />
                </span>
              </div>
              {/* Real e1RM metric only (plan A2): latest tracked point +
                  a real delta vs the base week; never "projected". */}
              <div style={metricBlockStyle}>
                <span style={metricLabelStyle}>{FOCUS_COPY.latestE1rmLabel}</span>
                <span data-testid="focus-e1rm" style={metricValueStyle}>
                  {latest ? `${latest.valueKg} kg` : "—"}
                </span>
                {delta !== null ? (
                  <span
                    data-testid="focus-delta"
                    title={FOCUS_COPY.deltaTitle}
                    style={deltaStyle}
                  >
                    {formatDelta(delta)}
                  </span>
                ) : null}
              </div>
            </header>
            <ChartLegend
              lineLabel={FOCUS_COPY.legendLine}
              barLabel={FOCUS_COPY.legendBar}
              peakLabel={peak ? `${FOCUS_COPY.peakPrefix}: ${peak.valueKg} kg e1RM` : undefined}
            />
            <ComboChart
              points={rows}
              ariaLabel={comboAriaLabel(focus)}
              barName="Volume"
              lineName="1RM"
              barUnit="kg"
              lineUnit="kg"
            />
            {focus.e1rmPoints.length < focus.weekCount ? (
              /* WHY only populated buckets render: no fill-forward — the hint
                 states the tracked-week count instead (plan §1/§11). */
              <p style={hintStyle}>
                {incompleteHint(focus.e1rmPoints.length, focus.weekCount, focus.exerciseName)}
              </p>
            ) : null}
            <VelocityRpeStrip
              title={FOCUS_COPY.stripTitle}
              meanLabel={FOCUS_COPY.stripMeanLabel}
              /* WHY sets=[]: no per-set velocity/RPE source exists in the
                 entity yet — the strip shows header + honest empty copy,
                 never fabricated tiles (plan A3). */
              sets={[]}
              emptyLabel={FOCUS_COPY.stripEmpty}
            />
          </article>
        </>
      )}
    </section>
  );
}
