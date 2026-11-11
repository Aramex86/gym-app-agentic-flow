/* shared/ui — training-history table ("Kinetic Obsidian").
   Styling via tokens (src/shared/ui/tokens.css) only — ADR-0001 D5.
   Reusable: data flows in via props (PlanWeek[]); the component imports
   NO data module and does NO fetching — the page owns SAMPLE_PLAN. */

import type { JSX } from "react";
import type { PlanExercise, PlanWeek } from "@shared/config/plan.schema";

export interface HistoryTableProps {
  weeks: PlanWeek[];
  caption?: string;
}

interface HistoryRow {
  week: number;
  split: string;
  exercise: PlanExercise;
}

/** Flatten weeks -> days -> exercises (generic, no assumptions on counts). */
function flattenRows(weeks: PlanWeek[]): HistoryRow[] {
  return weeks.flatMap((week) =>
    week.days.flatMap((day) =>
      day.exercises.map((exercise) => ({
        week: week.week,
        split: day.split,
        exercise,
      })),
    ),
  );
}

const CELL_STYLE = {
  padding: "var(--sp-sm) var(--sp-md)",
  textAlign: "left",
  whiteSpace: "nowrap",
} as const;

const NUMERIC_CELL_STYLE = {
  ...CELL_STYLE,
  fontFamily: "var(--font-metric)",
} as const;

const HEADER_STYLE = {
  position: "sticky",
  top: 0,
  background: "var(--surface)",
  color: "var(--text-muted)",
  font: "var(--label-caps)",
  textTransform: "uppercase",
  textAlign: "left",
  padding: "var(--sp-sm) var(--sp-md)",
} as const;

export function HistoryTable({
  weeks,
  caption = "Training history",
}: HistoryTableProps): JSX.Element {
  const rows = flattenRows(weeks);

  return (
    <div
      className="history-table"
      role="region"
      aria-label={caption}
      style={{
        overflow: "auto",
        maxHeight: "24rem",
        background: "var(--surface)",
        border: "1px solid var(--edge)",
        borderRadius: "var(--r-card)",
      }}
    >
      {/* Inline styles cannot express :hover — one scoped, token-only block.
          Row background lives here too: an inline background would beat the
          :hover rule; later-in-block hover at equal specificity wins. */}
      <style>{`
.history-table__row { background: var(--surface-lifted); border-bottom: 1px solid var(--edge); }
.history-table__row:hover { background: var(--surface); }
`}</style>
      <table
        style={{
          minWidth: "640px",
          width: "100%",
          borderCollapse: "collapse",
          color: "var(--text-high)",
        }}
      >
        <caption style={{ color: "var(--text-muted)", padding: "var(--sp-sm)" }}>
          {caption}
        </caption>
        <thead>
          <tr>
            <th scope="col" style={HEADER_STYLE}>Week</th>
            <th scope="col" style={HEADER_STYLE}>Split</th>
            <th scope="col" style={HEADER_STYLE}>Exercise</th>
            <th scope="col" style={HEADER_STYLE}>Sets × Reps</th>
            <th scope="col" style={HEADER_STYLE}>RPE</th>
            <th scope="col" style={HEADER_STYLE}>Rest</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                style={{ ...CELL_STYLE, color: "var(--text-muted)" }}
              >
                No history yet
              </td>
            </tr>
          ) : (
            rows.map(({ week, split, exercise }) => (
              <tr key={exercise.id} className="history-table__row" data-testid="history-row">
                <td style={NUMERIC_CELL_STYLE}>{week}</td>
                <td style={CELL_STYLE}>{split}</td>
                <td style={CELL_STYLE}>{exercise.name}</td>
                <td style={NUMERIC_CELL_STYLE}>
                  {exercise.sets} × {exercise.reps}
                </td>
                <td style={NUMERIC_CELL_STYLE}>{exercise.rpe}</td>
                <td style={NUMERIC_CELL_STYLE}>{exercise.restSec}s</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
