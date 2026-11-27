import { useState } from "react";
import { HistoryTable, Button, ToggleChip } from "@shared/ui";
import type { HistoryRowInfo } from "@shared/ui";
import { PlanDisclaimer } from "@features/plan-disclaimer";
import { PlanRecompose, PLAN_RECOMPOSE_ID } from "@features/plan-recompose";
import { ExerciseFocusChartCard } from "@features/progress-exercise-focus";
import { HistoryLog } from "@features/progress-history";
import { InsightCard } from "@features/progress-insight";
import { getTrainingPlan } from "@entities/training-plan";
import type { TrainingPlan } from "@entities/training-plan";

/* Thin page composition (FSAA pages layer): import -> derive -> render.
   No fetch — data access lives in @entities/training-plan, and the
   re-compose scenario lives in @features/plan-recompose. The current plan
   is page-local React state: it starts at the static SAMPLE_PLAN (via
   getTrainingPlan()) and is replaced by the validated plan the composer
   returns, re-deriving the metrics and the history table. The only other
   state is the page-local `compact` toggle (UI view state, not data). */

const cardStyle = {
  flex: "1 1 0",
  minWidth: "10rem",
  padding: "var(--sp-md)",
  background: "var(--surface-lifted)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-card)",
} as const;

const cardLabelStyle = {
  margin: 0,
  font: "var(--label-caps)",
  color: "var(--text-muted)",
  textTransform: "uppercase",
} as const;

const cardValueStyle = {
  margin: 0,
  fontFamily: "var(--font-metric)",
  fontSize: "var(--metric-lg-size)",
  fontWeight: "var(--metric-lg-weight)",
  color: "var(--text-high)",
} as const;

/* Row actions (Begin primary / Log secondary) — buttons come from the
   @shared/ui Button atom; styling lives there (token-only, ADR-0001 D5).
   Behavior is not wired yet — handlers stay stubs for now. */

const actionsCellStyle = {
  display: "flex",
  gap: "var(--sp-xs)",
} as const;

function handleBegin(row: HistoryRowInfo): void {
  console.info("[progress] begin", row.exercise.id); // TODO: wire behavior
}

function handleLog(row: HistoryRowInfo): void {
  console.info("[progress] log", row.exercise.id); // TODO: wire behavior
}

/* Scroll anchor target for the exercise-focus empty-state CTA (plan §8.3). */
function scrollToComposer(): void {
  // WHY: jsdom has no scrollIntoView — the optional call keeps tests
  // node-safe while production scrolls smoothly to the composer.
  document
    .getElementById(PLAN_RECOMPOSE_ID)
    ?.scrollIntoView?.({ behavior: "smooth", block: "center" });
}

export function ProgressPage() {
  const [compact, setCompact] = useState(false);
  // Current plan is page state (plan step 5): metrics + table re-render from
  // whatever the recompose scenario returns.
  const [plan, setPlan] = useState<TrainingPlan>(() => getTrainingPlan());
  const weeks = plan.weeks;
  const exercisesPerDay = weeks[0]?.days[0]?.exercises.length ?? 0;
  const totalSets = weeks
    .flatMap((week) => week.days)
    .flatMap((day) => day.exercises)
    .reduce((sum, exercise) => sum + exercise.sets, 0);

  return (
    <section style={{ padding: "var(--sp-lg)", display: "grid", gap: "var(--sp-lg)" }}>
      <div
        style={{
          display: "flex",
          gap: "var(--sp-md)",
          alignItems: "center",
        }}
      >
        <h2 style={{ margin: 0, color: "var(--text-high)" }}>Progress</h2>
        <ToggleChip
          on={compact}
          onToggle={() => setCompact((value) => !value)}
          label="Compact"
        />
      </div>

      {/* ADR-0001 D4: disclaimer sits directly under the plan header row.
          Profile -> variant selection lives in the feature, not the page. */}
      <PlanDisclaimer />

      {/* Plan A2: prompt box AFTER the disclaimer (D4 keeps it directly under
          the header row), BEFORE the metric cards. */}
      <PlanRecompose plan={plan} onPlanChange={setPlan} />

      <div style={{ display: "flex", gap: "var(--sp-md)" }}>
        <div style={cardStyle}>
          <p style={cardLabelStyle}>Weeks</p>
          <p style={cardValueStyle}>{weeks.length}</p>
        </div>
        <div style={cardStyle}>
          <p style={cardLabelStyle}>Exercises / day</p>
          <p style={cardValueStyle}>{exercisesPerDay}</p>
        </div>
        <div style={cardStyle}>
          <p style={cardLabelStyle}>Total sets</p>
          <p style={cardValueStyle}>{totalSets}</p>
        </div>
      </div>

      {/* Task A7/S6: insight card auto-loads its gate request on mount; the
          history log works offline — a failing insight never blocks it. */}
      <InsightCard />
      {/* Plan §8.3: focus charts between insight and history — the existing
          pairwise order assertions stay valid. */}
      <ExerciseFocusChartCard onCompose={scrollToComposer} />
      <HistoryLog />

      <HistoryTable
        weeks={weeks}
        compact={compact}
        actions={(row: HistoryRowInfo) => (
          <span style={actionsCellStyle}>
            <Button variant="primary" onClick={() => handleBegin(row)}>
              Begin
            </Button>
            <Button variant="secondary" onClick={() => handleLog(row)}>
              Log
            </Button>
          </span>
        )}
      />
    </section>
  );
}
