import { HistoryTable, Button } from "@shared/ui";
import type { HistoryRowInfo } from "@shared/ui";
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

/* Row actions (Begin primary / Log secondary) — buttons come from the
   @shared/ui Button atom; styling lives there (token-only, ADR-0001 D5).
   SAMPLE_PLAN is static, so handlers are stubs until behavior is wired. */

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

      <HistoryTable
        weeks={weeks}
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
