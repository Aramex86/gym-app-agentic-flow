/* entities/training-plan — types. Re-export of the shared plan contract:
   plan.schema.ts (mirrors docs/contracts/plan-schema.md §§3-5) stays the
   single source of truth — the entity competes with nothing. */

import type {
  Biometrics,
  ExperienceTierId,
  OrthopedicLimitationId,
  UserProfile,
} from "@entities/profile";
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

/** Canonical goal ids; payload goal order follows this list. */
export const TRAINING_GOAL_IDS = [
  "strength",
  "hypertrophy",
  "endurance",
  "fat-loss",
  "mobility",
] as const;

/** Stable goal ids used by onboarding goal selection and payload wiring. */
export type TrainingGoalId = (typeof TRAINING_GOAL_IDS)[number];

/** Orthopedic selections owned by the onboarding feature. */
export interface OrthopedicSelection {
  /** Selected limitation ids in arbitrary order; canonicalized on build. */
  limitations: readonly OrthopedicLimitationId[];
  /** Raw free-form caution; sent verbatim, never trimmed. */
  caution: string;
}

/** Session-local onboarding values merged into the generate profile payload. */
export interface GenerateProfilePatch {
  /** Overrides profile.biometrics; null clears it (required form incomplete). */
  biometrics?: Biometrics | null;
  /** Overrides profile.experienceTier; null clears it (tier unanswered). */
  experienceTier?: ExperienceTierId | null;
}

/** Wire request for POST /api/plan/generate. */
export interface GeneratePlanRequest {
  profile: UserProfile;
  goals: TrainingGoalId[];
  /** Ids of tracked hardware sources shown in the hardware map. */
  hardware: string[];
  /** Verbatim free-form safety caution from onboarding; "" when none. */
  caution: string;
}
