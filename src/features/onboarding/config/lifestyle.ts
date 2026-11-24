/* features/onboarding/config — lifestyle & recovery chip options.
   Layer reason: feature-local display labels for entity-level lifestyle ids
   (mirrors config/goals.ts); the moderate default itself lives in the entity
   (DEFAULT_LIFESTYLE_PROFILE) and is deliberately not duplicated here. */

import type {
  DailyActivityId,
  SleepDurationId,
  StressLevelId,
} from "@entities/profile";

/** One onboarding lifestyle option rendered as a chip. */
export interface LifestyleOption<Id extends string> {
  /** Stable entity id sent in the payload. */
  id: Id;
  /** Human-readable chip label. */
  label: string;
}

/** Ordered sleep-duration options aligned with SLEEP_DURATION_IDS. */
export const SLEEP_DURATION_OPTIONS: readonly LifestyleOption<SleepDurationId>[] = [
  { id: "under-6", label: "< 6 h" },
  { id: "6-7", label: "6-7 h" },
  { id: "7-8", label: "7-8 h" },
  { id: "over-8", label: "8+ h" },
];

/** Ordered daily-activity options aligned with DAILY_ACTIVITY_IDS. */
export const DAILY_ACTIVITY_OPTIONS: readonly LifestyleOption<DailyActivityId>[] = [
  { id: "sedentary", label: "Sedentary" },
  { id: "light", label: "Light" },
  { id: "moderate", label: "Moderate" },
  { id: "high", label: "High" },
];

/** Ordered stress-level options aligned with STRESS_LEVEL_IDS. */
export const STRESS_LEVEL_OPTIONS: readonly LifestyleOption<StressLevelId>[] = [
  { id: "low", label: "Low" },
  { id: "moderate", label: "Moderate" },
  { id: "high", label: "High" },
];
