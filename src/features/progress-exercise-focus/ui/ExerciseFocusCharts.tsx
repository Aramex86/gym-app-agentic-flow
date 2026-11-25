/* features/progress-exercise-focus — Exercise focus scenario for the
   Progress page. Layer reason: features/ui scenario composition; ALL data
   access goes through @entities/session-log selectors (no network of any
   kind here — AGENTS.md data rule) and every color comes from tokens
   (ADR-0001 D5). Charts are @shared/ui atoms; the feature derives the
   accessible names (aria-labels carrying every value) and the
   incomplete-window hint. */

import { useMemo, useState } from "react";
import type { JSX } from "react";
import {
  getSessionLog,
  selectExerciseFocus,
  selectTrackedExercises,
} from "@entities/session-log";
import type { ExerciseFocus, SessionLogEntry } from "@entities/session-log";
import { isComposerAvailable, useComposerStatus } from "@entities/composer";
import {
  ChoiceChipGroup,
  EmptyState,
  RangeBandChart,
  TrajectoryChart,
  Button,
} from "@shared/ui";
import type { ChoiceChipOption } from "@shared/ui";
import { FOCUS_COPY, incompleteHint } from "../config/focusCopy";

export interface ExerciseFocusChartsProps {
  /** Test-only seam; production reads getSessionLog(). */
  entries?: readonly SessionLogEntry[];
  /** Empty-state composer CTA (the page scrolls to the composer). */
  onCompose: () => void;
}

const sectionStyle = {
  display: "grid",
  gap: "var(--sp-sm)",
  padding: "var(--sp-md)",
  background: "var(--surface)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-card)",
} as const;

const headingStyle = {
  margin: 0,
  color: "var(--text-high)",
} as const;

const hintStyle = {
  margin: 0,
  color: "var(--text-muted)",
} as const;

const ctaStyle = {
  justifySelf: "start",
} as const;

/* Accessible table equivalents (plan §7.2 step 7): the aria-label carries
   EVERY value so non-visual users get exactly what the chart shows. */
function trajectoryAriaLabel(focus: ExerciseFocus): string {
  if (focus.e1rmPoints.length === 0) {
    return `${focus.exerciseName} estimated 1RM by week: no tracked weeks.`;
  }
  return `${focus.exerciseName} estimated 1RM by week: ${focus.e1rmPoints
    .map((point) => `week of ${point.weekStart} ${point.valueKg} kg`)
    .join("; ")}.`;
}

function volumeAriaLabel(focus: ExerciseFocus): string {
  if (focus.volumeBands.length === 0) {
    return `${focus.exerciseName} weekly volume dispersion: no tracked weeks.`;
  }
  return `${focus.exerciseName} weekly volume dispersion: ${focus.volumeBands
    .map((band) =>
      // WHY: collapsed bands (min === max) read as a single value — the
      // min–max range would repeat the same number twice.
      band.minVolumeKg === band.maxVolumeKg
        ? `week of ${band.weekStart} ${band.meanVolumeKg} kg`
        : `week of ${band.weekStart} ${band.minVolumeKg}–${band.maxVolumeKg} kg (avg ${band.meanVolumeKg} kg)`,
    )
    .join("; ")}.`;
}

/**
 * Renders the per-exercise deep-dive block: exercise chip selector, the
 * 4-week e1RM trajectory chart, the weekly volume-dispersion chart and the
 * incomplete-window hint; an empty state with a composer CTA replaces all
 * of it when nothing is tracked in the window.
 * @param props Optional raw entries override (test seam) + CTA callback.
 * @returns The exercise-focus section.
 * @remarks Composer CTA is disabled ONLY for a confirmed offline status
 *   (unknown/online stay enabled — same gate as PlanRecompose, plan A4).
 */
export function ExerciseFocusCharts(props: ExerciseFocusChartsProps): JSX.Element {
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

  return (
    <section aria-label={FOCUS_COPY.heading} style={sectionStyle}>
      <h3 style={headingStyle}>{FOCUS_COPY.heading}</h3>
      {options.length === 0 || !focus ? (
        <>
          <EmptyState title={FOCUS_COPY.emptyTitle} description={FOCUS_COPY.emptyDescription} />
          <span style={ctaStyle}>
            {/* WHY disabled only when offline: a not-yet-checked composer
                (unknown) must not block the CTA — plan A4 / composerStatus. */}
            <Button variant="primary" onClick={props.onCompose} disabled={composerOffline}>
              {FOCUS_COPY.composerCta}
            </Button>
          </span>
        </>
      ) : (
        <>
          <ChoiceChipGroup
            legend={FOCUS_COPY.selectorLegend}
            options={options}
            value={selected}
            onChange={setSelectedId}
          />
          <figure style={{ margin: 0, display: "grid", gap: "var(--sp-xs)" }}>
            <figcaption style={hintStyle}>
              {FOCUS_COPY.trajectoryTitle} · {focus.exerciseName}
            </figcaption>
            <TrajectoryChart
              points={focus.e1rmPoints.map((point) => ({
                label: point.weekStart,
                value: point.valueKg,
              }))}
              unit="kg"
              ariaLabel={trajectoryAriaLabel(focus)}
            />
          </figure>
          {focus.e1rmPoints.length < focus.weekCount ? (
            /* WHY only populated buckets render: no fill-forward — the hint
               states the tracked-week count instead (plan §1/§11). */
            <p style={hintStyle}>
              {incompleteHint(focus.e1rmPoints.length, focus.weekCount, focus.exerciseName)}
            </p>
          ) : null}
          <figure style={{ margin: 0, display: "grid", gap: "var(--sp-xs)" }}>
            <figcaption style={hintStyle}>
              {FOCUS_COPY.volumeTitle} · {focus.exerciseName}
            </figcaption>
            <RangeBandChart
              bands={focus.volumeBands.map((band) => ({
                label: band.weekStart,
                min: band.minVolumeKg,
                max: band.maxVolumeKg,
                mean: band.meanVolumeKg,
              }))}
              unit="kg"
              ariaLabel={volumeAriaLabel(focus)}
            />
          </figure>
        </>
      )}
    </section>
  );
}
