/* entities/session-log — data access. Session entries come from the static
   sample (Logger wiring out of scope, task A1); the insight is requested
   from the gym-gate ONLY (ADR-0008: the gate owns the model call; this
   client never contacts a provider, never imports a model SDK — ADR-0005).
   The wire contract mirrored below is docs/contracts/progress-insight.md;
   the doc wins on disagreement. Layer reason: the ONLY fetch of the insight
   flow lives here (AGENTS.md data rule); features call these exports. */

import type {
  InsightSessionSummary,
  ReviewInsight,
  ReviewPeriod,
  SessionLogEntry,
} from "./types";
import { SESSION_LOG_SAMPLE } from "./sample";

/** Same-origin gym-gate endpoint (docs/contracts/progress-insight.md). */
export const INSIGHT_ENDPOINT = "/api/progress/insight";
/** Model id SENT to the gate; routing is the gate's business (ADR-0008). */
export const INSIGHT_MODEL = "kimi-k3.1";

/** Fixed, non-leaky message for every insight failure mode (network, HTTP,
    bad JSON, invalid payload) — the UI shows its own copy on top. */
const INSIGHT_ERROR_MESSAGE = "Could not load the AI review.";

/** Error raised for every insight request failure. Never carries details
    from the failing response (non-leaky, per docs/contracts/progress-insight.md). */
export class InsightRequestError extends Error {
  constructor(message: string = INSIGHT_ERROR_MESSAGE) {
    super(message);
    this.name = "InsightRequestError";
  }
}

export interface RequestReviewInsightInput {
  period: ReviewPeriod;
  sessions: InsightSessionSummary[];
}

/**
 * Returns the static sample log (stable identity across calls).
 * @returns Readonly session entries in ascending date order.
 * @remarks Do not mutate the returned array.
 */
export function getSessionLog(): readonly SessionLogEntry[] {
  return SESSION_LOG_SAMPLE;
}

/**
 * Requests the AI review insight through the gym-gate (same origin).
 * Wire contract = docs/contracts/progress-insight.md:
 *   POST /api/progress/insight, Content-Type: application/json,
 *   body = { model: INSIGHT_MODEL, period, sessions };
 *   a 2xx JSON body is { periodId, model, insight }; the gate performs the
 *   model call. Every failure (network, non-2xx, invalid JSON, payload not
 *   validating — periodId mismatch, missing/non-empty prose) is normalized
 *   to InsightRequestError with the fixed message above.
 * @param input The derived period plus per-session summaries.
 * @returns The validated insight payload.
 * @remarks Call from feature logic only; never call providers directly.
 */
export async function requestReviewInsight(
  input: RequestReviewInsightInput,
): Promise<ReviewInsight> {
  let response: Response;
  try {
    response = await fetch(INSIGHT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: INSIGHT_MODEL,
        period: input.period,
        sessions: input.sessions,
      }),
    });
  } catch {
    throw new InsightRequestError();
  }

  if (!response.ok) {
    throw new InsightRequestError();
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new InsightRequestError();
  }

  if (!isReviewInsight(payload, input.period.id)) {
    throw new InsightRequestError();
  }

  return payload;
}

/** Payload validation per docs/contracts/progress-insight.md (response side). */
function isReviewInsight(payload: unknown, expectedPeriodId: string): payload is ReviewInsight {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  return (
    candidate.periodId === expectedPeriodId &&
    typeof candidate.model === "string" &&
    candidate.model.length > 0 &&
    typeof candidate.insight === "string" &&
    candidate.insight.length > 0
  );
}
