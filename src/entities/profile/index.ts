/* entities/profile — public API. Consumers import ONLY here
   (@entities/profile), never deep entity paths. */

export type {
  UserProfile,
  LifestyleProfile,
  SleepDurationId,
  DailyActivityId,
  StressLevelId,
  OrthopedicLimitationId,
  Biometrics,
  BiometricsDraft,
  BiometricFieldId,
  BiometricsIssue,
  BiometricsIssueCode,
  ExperienceTierId,
} from "./types";
export {
  SLEEP_DURATION_IDS,
  DAILY_ACTIVITY_IDS,
  STRESS_LEVEL_IDS,
  ORTHOPEDIC_LIMITATION_IDS,
  DEFAULT_LIFESTYLE_PROFILE,
  DEFAULT_ORTHOPEDIC_PROFILE,
  BIOMETRIC_FIELDS,
  BIOMETRIC_RANGES,
  EMPTY_BIOMETRICS_DRAFT,
  EXPERIENCE_TIER_IDS,
  EXPERIENCE_VOLUME_MULTIPLIERS,
  DEFAULT_ONBOARDING_PROFILE,
} from "./types";
export { getActiveProfile, saveActiveProfile } from "./api";
export {
  hasHealthConditions,
  validateBiometrics,
  isBiometricsComplete,
  toBiometrics,
  toBiometricsDraft,
  getExperienceVolumeMultiplier,
  resetActiveProfile,
} from "./slice";
