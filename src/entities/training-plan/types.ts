/* entities/training-plan — types. Re-export of the shared plan contract:
   plan.schema.ts (mirrors docs/contracts/plan-schema.md §§3-5) stays the
   single source of truth — the entity competes with nothing. */

export type {
  TrainingPlan,
  PlanWeek,
  PlanDay,
  PlanExercise,
} from "@shared/config/plan.schema";
