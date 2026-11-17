/* shared/config/activePlan — module-level active plan store.
   Layer reason: shared state hand-off between onboarding generation and progress page. */

import type { TrainingPlan } from "./plan.schema";

let activePlan: TrainingPlan | null = null;

/**
 * Returns the current generated plan in memory.
 * @returns Active plan reference, or null when none was generated yet.
 * @remarks Do not use for persisted storage; this store is reset on reload.
 */
export function getActivePlan(): TrainingPlan | null {
  return activePlan;
}

/**
 * Stores the active generated plan reference.
 * @param plan Validated plan to expose to plan readers.
 * @returns Nothing.
 * @remarks Do not pass unvalidated payloads; callers must validate first.
 */
export function setActivePlan(plan: TrainingPlan): void {
  activePlan = plan;
}

/**
 * Clears the active plan store.
 * @returns Nothing.
 * @remarks Test seam only; avoid in production logic.
 */
export function resetActivePlan(): void {
  activePlan = null;
}
