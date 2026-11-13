/* entities/training-plan — data access. Synchronous accessor over the
   static SAMPLE_PLAN: the source is static, so no async/loading surface.
   A future remote plan swaps this file without touching features. */

import type { TrainingPlan } from "./types";
import { SAMPLE_PLAN } from "@shared/config/plan.sample";

export function getTrainingPlan(): TrainingPlan {
  return SAMPLE_PLAN;
}
