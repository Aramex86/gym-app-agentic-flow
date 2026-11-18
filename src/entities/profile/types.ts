/* entities/profile — cross-feature data model for the active user profile.
   Business consumers (features/pages) import only @entities/profile. */

/** Canonical sleep-duration buckets (wire ids, ordered low → high). */
export const SLEEP_DURATION_IDS = ["under-6", "6-7", "7-8", "over-8"] as const;
/** Wire id of one sleep-duration bucket; see SLEEP_DURATION_IDS. */
export type SleepDurationId = (typeof SLEEP_DURATION_IDS)[number];

/** Canonical daily-activity levels (wire ids, ordered low → high). */
export const DAILY_ACTIVITY_IDS = ["sedentary", "light", "moderate", "high"] as const;
/** Wire id of one daily-activity level; see DAILY_ACTIVITY_IDS. */
export type DailyActivityId = (typeof DAILY_ACTIVITY_IDS)[number];

/** Canonical stress/cortisol levels (wire ids, ordered low → high). */
export const STRESS_LEVEL_IDS = ["low", "moderate", "high"] as const;
/** Wire id of one stress/cortisol level; see STRESS_LEVEL_IDS. */
export type StressLevelId = (typeof STRESS_LEVEL_IDS)[number];

/** Lifestyle & recovery context that shapes volume/intensity targets. */
export interface LifestyleProfile {
  /** Sleep-duration bucket the user reports. */
  sleepDuration: SleepDurationId;
  /** Overall daily activity level (single-select, exclusive). */
  dailyActivity: DailyActivityId;
  /** Self-assessed stress level. */
  stressLevel: StressLevelId;
}

/** Skippable-field defaults: healthy sleep, moderate activity, moderate stress. */
export const DEFAULT_LIFESTYLE_PROFILE = {
  sleepDuration: "7-8",
  dailyActivity: "moderate",
  stressLevel: "moderate",
} as const satisfies LifestyleProfile;

export interface UserProfile {
  id: string;
  name: string;
  /** Declared medical conditions; empty when the user listed none. */
  diseases: readonly string[];
  /** Declared physical problems (e.g. injuries); empty when none. */
  physicalProblems: readonly string[];
  /** Lifestyle & recovery context; defaults to moderate when the user skips. */
  lifestyle: LifestyleProfile;
}
