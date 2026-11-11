/* shared/ui — training-history table ("Kinetic Obsidian").
   Styling via tokens (src/shared/ui/tokens.css) only — ADR-0001 D5.
   Reusable: data flows in via props (PlanWeek[]); the component imports
   NO data module and does NO fetching — the page owns SAMPLE_PLAN. */

import type { JSX, ReactNode } from "react";
import type { PlanExercise, PlanWeek } from "@shared/config/plan.schema";

export interface HistoryTableProps {
  weeks: PlanWeek[];
  caption?: string;
  /** Optional trailing "Actions" column; the page supplies actual buttons. */
  actions?: (row: HistoryRowInfo) => ReactNode;
}

/** Shape of one flattened row — exported so pages can type action handlers. */
export interface HistoryRowInfo {
  week: number;
  split: string;
  exercise: PlanExercise;
}

type HistoryRow = HistoryRowInfo;

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

/* Action cells hold buttons, not metrics — no mono font here. */
const ACTION_CELL_STYLE = {
  ...CELL_STYLE,
  padding: "var(--sp-xs) var(--sp-md)",
} as const;

export function HistoryTable({
  weeks,
  caption = "Training history",
  actions,
}: HistoryTableProps): JSX.Element {
  const rows = flattenRows(weeks);
  const columns = 6 + (actions ? 1 : 0);

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
/* Thin scrollbar (standard properties: Chromium 121+, Firefox). */
.history-table { scrollbar-width: thin; scrollbar-color: var(--surface-bright) transparent; }
/* WebKit fallback (Safari, older Chromium). */
.history-table::-webkit-scrollbar { width: 8px; height: 8px; }
.history-table::-webkit-scrollbar-track { background: transparent; }
.history-table::-webkit-scrollbar-thumb {
  background: var(--edge);
  border-radius: var(--r-pill);
  border: 2px solid transparent;
  background-clip: content-box;
}
.history-table::-webkit-scrollbar-thumb:hover { background: var(--text-muted); background-clip: content-box; }
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
            {actions ? (
              <th scope="col" style={HEADER_STYLE}>Actions</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns}
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
                {actions ? (
                  <td style={ACTION_CELL_STYLE}>
                    {actions({ week, split, exercise })}
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
