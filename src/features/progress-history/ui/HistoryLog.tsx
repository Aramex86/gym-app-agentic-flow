/* features/progress-history — session history log composition (S4).
   Layer reason: features/ui scenario; renders the newest-first session list
   with PR badges from the entity selectors (no fetch — PRs are computed
   client-side, so a badge renders with 0 network requests, task A2). */

import { useMemo } from "react";
import type { JSX } from "react";
import {
  getSessionLog,
  selectSessionLogRows,
  selectSessionsNewestFirst,
} from "@entities/session-log";
import type { SessionLogEntry } from "@entities/session-log";
import { HistoryLogRow } from "./HistoryLogRow";

export interface HistoryLogProps {
  /** Test-only seam; production renders the entity sample. */
  entries?: readonly SessionLogEntry[];
}

const sectionStyle = {
  display: "grid",
  gap: "var(--sp-sm)",
} as const;

const headingStyle = {
  margin: 0,
  color: "var(--text-high)",
} as const;

const listStyle = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "grid",
  gap: "var(--sp-sm)",
} as const;

const emptyStyle = {
  margin: 0,
  color: "var(--text-muted)",
} as const;

/**
 * Renders the chronological session log, newest-first (A3/A5), with PR
 * badges derived from the log itself.
 * @param props Optional raw entries override (test seam).
 * @returns The session-history section, or a muted empty state.
 * @remarks No network access here; supply real data through the entity.
 */
export function HistoryLog({ entries }: HistoryLogProps): JSX.Element {
  // WHY: one derivation pass — ascending walk (PR detection) then the
  // newest-first view (visible order); both are pure entity selectors.
  const rows = useMemo(
    () => selectSessionsNewestFirst(selectSessionLogRows(entries ?? getSessionLog())),
    [entries],
  );

  return (
    <section aria-label="Session history" style={sectionStyle}>
      <h3 style={headingStyle}>History log</h3>
      {rows.length === 0 ? (
        <p style={emptyStyle}>No sessions logged yet.</p>
      ) : (
        <ol style={listStyle}>
          {rows.map((row) => (
            <HistoryLogRow key={row.id} row={row} />
          ))}
        </ol>
      )}
    </section>
  );
}
