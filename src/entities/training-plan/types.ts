/* entities/training-plan — types. Re-export of the shared plan contract:
   plan.schema.ts (mirrors docs/contracts/plan-schema.md §§3-5) stays the
   single source of truth — the entity competes with nothing. */

import type { UserProfile } from "@entities/profile";
import type { TrainingPlan } from "@shared/config/plan.schema";

export type {
  TrainingPlan,
  PlanWeek,
  PlanDay,
  PlanExercise,
} from "@shared/config/plan.schema";

/** Wire request for POST /api/plan (plan A3): composer = profile + current
    plan + free-form instruction. Same-layer entity-to-entity type import
    (profile imports nothing from here — no cycle). */
export interface RecomposePlanRequest {
  profile: UserProfile;
  plan: TrainingPlan;
  instruction: string;
}
