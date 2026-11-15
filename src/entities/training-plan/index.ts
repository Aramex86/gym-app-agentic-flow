/* entities/training-plan — public API. Consumers import ONLY here
   (@entities/training-plan), never deep entity paths. */

export type { TrainingPlan, PlanWeek, PlanDay, PlanExercise } from "./types";
export type { RecomposePlanRequest } from "./types";
export { getTrainingPlan } from "./api";
export { recomposePlan, PlanRecomposeError } from "./api";
export { filterPlanWeeksByExerciseName } from "./slice";
