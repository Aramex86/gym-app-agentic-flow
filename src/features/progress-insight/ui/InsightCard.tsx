/* features/progress-insight — AI review insight card for the current review
   period (S5). Layer reason: features/ui scenario; all data access goes
   through @entities/session-log (NO fetch here, no provider URL, no model
   SDK — the gym-gate owns the model call, ADR-0008; the model id leaves
   only from the entity API). Auto-loads on
   mount (task A7): pending -> skeleton, failure -> retry, no sessions ->
   muted empty state; offline failure never blocks the history log. */

import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import {
  INSIGHT_MODEL,
  getSessionLog,
  requestReviewInsight,
  selectInsightSessionSummaries,
  selectReviewPeriod,
  selectSessionLogRows,
  selectSessionsNewestFirst,
} from "@entities/session-log";
import type { ReviewInsight, SessionLogEntry } from "@entities/session-log";
import { AlertBanner, Button, Skeleton } from "@shared/ui";

export interface InsightCardProps {
  /** Test-only seam; production derives from the entity sample. */
  entries?: readonly SessionLogEntry[];
}

type InsightState =
  | { status: "pending" }
  | { status: "success"; insight: ReviewInsight }
  | { status: "error" }
  | { status: "empty" };

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

const provenanceStyle = {
  margin: 0,
  color: "var(--text-muted)",
  font: "var(--label-caps)",
  textTransform: "uppercase",
} as const;

const insightTextStyle = {
  margin: 0,
  color: "var(--text-high)",
} as const;

const mutedStyle = {
  margin: 0,
  color: "var(--text-muted)",
} as const;

const retryStyle = {
  justifySelf: "start",
} as const;

/**
 * Renders the AI review card: skeleton while the gate request is pending,
 * insight prose on success, retry on failure, muted empty state when no
 * sessions fall in the period.
 * @param props Optional raw entries override (test seam).
 * @returns The AI review section.
 * @remarks Auto-requests on mount; the model call happens in the gym-gate.
 */
export function InsightCard({ entries }: InsightCardProps): JSX.Element {
  const source = entries ?? getSessionLog();
  const rows = useMemo(() => selectSessionsNewestFirst(selectSessionLogRows(source)), [source]);
  const period = useMemo(() => selectReviewPeriod(source), [source]);
  // WHY: summaries derive from the already-memoized `rows` — the selector
  // re-sorts ascending internally, so no second derivation pass is needed.
  const summaries = useMemo(
    () => (period ? selectInsightSessionSummaries(rows, period) : []),
    [rows, period],
  );

  const [state, setState] = useState<InsightState>({ status: "pending" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!period) {
      setState({ status: "empty" });
      return;
    }
    let cancelled = false;
    setState({ status: "pending" });
    requestReviewInsight({ period, sessions: summaries })
      .then((insight) => {
        if (!cancelled) setState({ status: "success", insight });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    // WHY: `cancelled` guard — an unmounted or superseded attempt must not
    // write state (StrictMode double-mount / stale responses, task S5).
    return () => {
      cancelled = true;
    };
    // No react-hooks/exhaustive-deps rule in this repo's config (no such
    // plugin loaded): deps are deliberate per task S5 — `attempt` drives
    // Retry; period/summaries are memoized on `source` (stable identity).
  }, [attempt, period?.id, rows]);

  return (
    <section aria-label="AI review insight" style={sectionStyle}>
      <h3 style={headingStyle}>AI review</h3>
      {period ? (
        <p style={provenanceStyle}>
          {INSIGHT_MODEL} · {period.label}
        </p>
      ) : null}
      {state.status === "pending" ? <Skeleton label="Loading AI review" lines={3} /> : null}
      {state.status === "error" ? (
        <div style={{ display: "grid", gap: "var(--sp-sm)" }}>
          <AlertBanner message="Could not load the AI review." />
          <span style={retryStyle}>
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </Button>
          </span>
        </div>
      ) : null}
      {state.status === "success" ? (
        <p style={insightTextStyle}>{state.insight.insight}</p>
      ) : null}
      {state.status === "empty" ? (
        <p style={mutedStyle}>No sessions in this period yet.</p>
      ) : null}
    </section>
  );
}
