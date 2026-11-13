/* entities/training-plan — public API. Consumers import ONLY here
   (@entities/training-plan), never deep entity paths. */

export type { TrainingPlan, PlanWeek, PlanDay, PlanExercise } from "./types";
export { getTrainingPlan } from "./api";
export { filterPlanWeeksByExerciseName } from "./slice";
