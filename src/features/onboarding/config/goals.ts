/* features/onboarding/config — onboarding goal options.
   Layer reason: feature-local display labels for entity-level goal ids. */

import type { TrainingGoalId } from "@entities/training-plan";

/** One onboarding goal option rendered as a chip. */
export interface GoalOption {
  /** Stable goal id sent in the generate payload. */
  id: TrainingGoalId;
  /** Human-readable label shown on goal chips. */
  label: string;
}

/** Ordered onboarding goal options aligned with TRAINING_GOAL_IDS. */
export const GOAL_OPTIONS: readonly GoalOption[] = [
  { id: "strength", label: "Strength" },
  { id: "hypertrophy", label: "Hypertrophy" },
  { id: "endurance", label: "Endurance" },
  { id: "fat-loss", label: "Fat loss" },
  { id: "mobility", label: "Mobility" },
];
