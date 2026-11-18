/* entities/profile — public API. Consumers import ONLY here
   (@entities/profile), never deep entity paths. */

export type {
  UserProfile,
  LifestyleProfile,
  SleepDurationId,
  DailyActivityId,
  StressLevelId,
} from "./types";
export {
  SLEEP_DURATION_IDS,
  DAILY_ACTIVITY_IDS,
  STRESS_LEVEL_IDS,
  DEFAULT_LIFESTYLE_PROFILE,
} from "./types";
export { getActiveProfile } from "./api";
export { hasHealthConditions } from "./slice";
