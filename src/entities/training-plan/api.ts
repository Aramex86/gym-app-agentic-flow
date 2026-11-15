/* entities/training-plan — data access. Synchronous accessor over the
   static SAMPLE_PLAN: the source is static, so no async/loading surface.
   The ONLY fetch in this entity (and the only one reachable from the
   plan screen) is recomposePlan — remote composer call; a feature calls
   this export, never fetch. A future remote plan-source would swap this
   file without touching features. */

import type { RecomposePlanRequest, TrainingPlan } from "./types";
import { isPlan, validatePlan } from "@shared/config/plan.schema";
import { SAMPLE_PLAN } from "@shared/config/plan.sample";

/** Path of the gym-gate composer endpoint (plan A3: backend lives outside
    this repo; a contract change only alters this constant/shape). */
const RECOMPOSE_ENDPOINT = "/api/plan";

/** Error raised for every composer failure (network, HTTP, bad payload). */
export class PlanRecomposeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanRecomposeError";
  }
}

/**
 * Sends profile + current plan + instruction to the gym-gate composer.
 * Wire contract (plan A3 — assumed; backend owner aligns here only):
 *   POST /api/plan, Content-Type: application/json,
 *   body = { profile: UserProfile, plan: TrainingPlan, instruction: string };
 *   a 2xx JSON body IS the updated TrainingPlan (no envelope).
 * Every failure mode (network, non-2xx, invalid JSON, plan failing the
 * docs/contracts/plan-schema.md R1-R9 validation) is normalized into a
 * PlanRecomposeError; the instruction is NOT trimmed here — input
 * normalization belongs to the feature (plan A4).
 */
export async function recomposePlan(
  request: RecomposePlanRequest,
): Promise<TrainingPlan> {
  let response: Response;
  try {
    response = await fetch(RECOMPOSE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new PlanRecomposeError("Could not reach the plan composer.");
  }

  if (!response.ok) {
    throw new PlanRecomposeError(`Plan composer failed (HTTP ${response.status}).`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PlanRecomposeError("Plan composer returned invalid JSON.");
  }

  if (!isPlan(payload)) {
    throw new PlanRecomposeError(
      `Plan composer returned an invalid plan: ${validatePlan(payload)[0]?.message ?? "unknown contract violation"}.`,
    );
  }

  return payload;
}

export function getTrainingPlan(): TrainingPlan {
  return SAMPLE_PLAN;
}
