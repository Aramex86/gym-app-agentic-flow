/* features/progress-history — one session row of the history log (S4).
   Layer reason: features/ui scenario composition; data arrives as a derived
   SessionLogRow prop, badges use the shared Badge atom. No fetch — PR data
   was computed by @entities/session-log selectors (0 network requests). */

import type { JSX } from "react";
import { Badge } from "@shared/ui";
import type { SessionLogRow } from "@entities/session-log";

export interface HistoryLogRowProps {
  /** Derived row (records already computed by the entity slice). */
  row: SessionLogRow;
}

const rowStyle = {
  display: "grid",
  gap: "var(--sp-xs)",
  padding: "var(--sp-sm) var(--sp-md)",
  background: "var(--surface)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-card)",
} as const;

const metaStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--sp-sm)",
  alignItems: "baseline",
} as const;

const metaValueStyle = {
  margin: 0,
  color: "var(--text-high)",
} as const;

const metaUnitStyle = {
  margin: 0,
  color: "var(--text-muted)",
  font: "var(--label-caps)",
  textTransform: "uppercase",
} as const;

const recordsStyle = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: "var(--sp-xs)",
} as const;

const recordItemStyle = {
  display: "flex",
  gap: "var(--sp-sm)",
  alignItems: "center",
  color: "var(--text-muted)",
} as const;

/**
 * Renders one logged session: date, split, duration, set volume and any PR
 * badges derived by the entity selectors.
 * @param props The derived session row to display.
 * @returns A list item; embed in the parent <ol> of the history log.
 * @remarks Do not pass raw entries; derive records via @entities/session-log.
 */
export function HistoryLogRow({ row }: HistoryLogRowProps): JSX.Element {
  const totalSets = row.sets.reduce((n, set) => n + set.sets, 0);
  return (
    <li data-testid="session-row" style={rowStyle}>
      <div style={metaStyle}>
        <time dateTime={row.date} style={metaValueStyle}>
          {row.date}
        </time>
        <p style={metaUnitStyle}>{row.split}</p>
        <p style={metaUnitStyle}>{row.durationMin} min</p>
        {/* WHY: single template literal, not interleaved JSX expressions —
            one text node, so the volume summary matches as one string. */}
        <p style={metaUnitStyle}>{`${row.sets.length} exercises · ${totalSets} sets`}</p>
      </div>
      {row.records.length > 0 ? (
        <ul aria-label="Personal records" style={recordsStyle}>
          {row.records.map((record) => (
            <li
              key={`${record.exerciseId}-${record.kind}`}
              style={recordItemStyle}
            >
              <Badge
                label="PR"
                tone="volt"
                title={`New best estimated 1RM on ${record.exerciseName}`}
              />
              <p style={recordItemTextStyle}>
                {record.exerciseName} · e1RM {record.valueKg} kg (was {record.previousKg} kg)
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

const recordItemTextStyle = {
  margin: 0,
} as const;
