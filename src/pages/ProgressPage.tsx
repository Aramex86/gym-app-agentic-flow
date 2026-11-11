import { HistoryTable } from "@shared/ui";
import { SAMPLE_PLAN } from "@shared/config/plan.sample";

/* Thin page composition (FSAA pages layer): import -> derive -> render.
   No fetch, no state, no effects — data is the static SAMPLE_PLAN. */

const weeks = SAMPLE_PLAN.weeks;
const exercisesPerDay = weeks[0]?.days[0]?.exercises.length ?? 0;
const totalSets = weeks
  .flatMap((week) => week.days)
  .flatMap((day) => day.exercises)
  .reduce((sum, exercise) => sum + exercise.sets, 0);

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

export function ProgressPage() {
  return (
    <section style={{ padding: "var(--sp-lg)", display: "grid", gap: "var(--sp-lg)" }}>
      <h2 style={{ margin: 0, color: "var(--text-high)" }}>Progress</h2>

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

      <HistoryTable weeks={weeks} />
    </section>
  );
}
