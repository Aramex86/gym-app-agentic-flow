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

/** Canonical orthopedic limitation ids (wire ids, ordered for the UI). */
export const ORTHOPEDIC_LIMITATION_IDS = [
  "knee",
  "lower-back",
  "shoulder",
  "wrist",
  "custom",
] as const;
/** Wire id of one orthopedic limitation; see ORTHOPEDIC_LIMITATION_IDS. */
export type OrthopedicLimitationId = (typeof ORTHOPEDIC_LIMITATION_IDS)[number];

/** Skippable orthopedic defaults: no protection tags, no caution text. */
export const DEFAULT_ORTHOPEDIC_PROFILE = {
  orthopedicLimitations: [],
  caution: "",
} as const satisfies Pick<UserProfile, "orthopedicLimitations" | "caution">;

export interface UserProfile {
  id: string;
  name: string;
  /** Declared medical conditions; empty when the user listed none. */
  diseases: readonly string[];
  /** Declared physical problems (e.g. injuries); empty when none. */
  physicalProblems: readonly string[];
  /** Lifestyle & recovery context; defaults to moderate when the user skips. */
  lifestyle: LifestyleProfile;
  /** Required biometrics for plan generation; null until onboarding completes. */
  biometrics: Biometrics | null;
  /** Required self-reported experience tier; null until the user picks one. */
  experienceTier: ExperienceTierId | null;
  /** Joints/movements the plan must protect; empty when the user skipped. */
  orthopedicLimitations: readonly OrthopedicLimitationId[];
  /** Verbatim free-form caution for the composer; "" when the user skipped. */
  caution: string;
}

/** Canonical biometric fields, ordered for the form (age -> height -> weight). */
export const BIOMETRIC_FIELDS = ["ageYears", "heightCm", "weightKg"] as const;
/** Wire id of one biometric field; see BIOMETRIC_FIELDS. */
export type BiometricFieldId = (typeof BIOMETRIC_FIELDS)[number];

export interface Biometrics {
  /** Self-reported age in whole years. */
  ageYears: number;
  /** Self-reported height in whole centimetres. */
  heightCm: number;
  /** Self-reported body weight in kilograms (decimals allowed). */
  weightKg: number;
}

/** Raw form draft: user text before validation/normalization. */
export interface BiometricsDraft {
  ageYears: string;
  heightCm: string;
  weightKg: string;
}

/** First-run draft: every required field unanswered. */
export const EMPTY_BIOMETRICS_DRAFT: BiometricsDraft = {
  ageYears: "",
  heightCm: "",
  weightKg: "",
};

/** Why one biometric field's draft text is not acceptable yet. */
export type BiometricsIssueCode =
  | "required"
  | "not-a-number"
  | "not-an-integer"
  | "out-of-range";

/** One validation problem on one biometric field (at most one per field). */
export interface BiometricsIssue {
  /** The rejected field, in BIOMETRIC_FIELDS terms. */
  field: BiometricFieldId;
  /** Why the draft text is rejected; see BiometricsIssueCode. */
  code: BiometricsIssueCode;
}

/** Canonical accepted ranges; `unit` is the domain unit (years/cm/kg). */
export const BIOMETRIC_RANGES = {
  ageYears: { min: 13, max: 100, integer: true, unit: "years" },
  heightCm: { min: 120, max: 250, integer: true, unit: "cm" },
  weightKg: { min: 30, max: 300, integer: false, unit: "kg" },
} as const satisfies Record<
  BiometricFieldId,
  { min: number; max: number; integer: boolean; unit: string }
>;

/** Canonical experience tiers, ordered low -> high. */
export const EXPERIENCE_TIER_IDS = ["novice", "intermediate", "advanced"] as const;
/** Wire id of one experience tier; see EXPERIENCE_TIER_IDS. */
export type ExperienceTierId = (typeof EXPERIENCE_TIER_IDS)[number];

/** Volume multipliers the composer applies per experience tier (A4). */
export const EXPERIENCE_VOLUME_MULTIPLIERS = {
  novice: 0.8,
  intermediate: 1,
  advanced: 1.2,
} as const satisfies Record<ExperienceTierId, number>;

/** First-run values for the required onboarding fields (not answered yet). */
export const DEFAULT_ONBOARDING_PROFILE = {
  biometrics: null,
  experienceTier: null,
} as const satisfies Pick<UserProfile, "biometrics" | "experienceTier">;
