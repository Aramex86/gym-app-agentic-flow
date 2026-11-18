/* entities/training-plan — public API. Consumers import ONLY here
   (@entities/training-plan), never deep entity paths. */

export type { TrainingPlan, PlanWeek, PlanDay, PlanExercise } from "./types";
export type {
  RecomposePlanRequest,
  GeneratePlanRequest,
  TrainingGoalId,
} from "./types";
export { TRAINING_GOAL_IDS } from "./types";
export { getTrainingPlan } from "./api";
export {
  recomposePlan,
  generatePlan,
  PlanRecomposeError,
  PlanGenerateError,
} from "./api";
export { filterPlanWeeksByExerciseName, buildGeneratePlanRequest } from "./slice";
