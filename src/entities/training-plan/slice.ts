/* entities/training-plan — pure filtering logic. Immutable projection:
   original week/day/exercise objects are never mutated; the original
   array reference is returned for empty queries. Matches exercise NAMES
   only — split/focus/week numbers are deliberately not searchable. */

import type {
  GeneratePlanRequest,
  GenerateProfilePatch,
  OrthopedicSelection,
  PlanDay,
  PlanWeek,
  TrainingGoalId,
} from "./types";
import type { OrthopedicLimitationId } from "@entities/profile";
import { ORTHOPEDIC_LIMITATION_IDS } from "@entities/profile";
import { TRAINING_GOAL_IDS } from "./types";
import type { LifestyleProfile, UserProfile } from "@entities/profile";

/**
 * Filters plan weeks by exercise name query.
 * @param weeks Plan weeks to search.
 * @param query Case-insensitive text to match in exercise names.
 * @returns Filtered hierarchy, or the original weeks reference for empty queries.
 * @remarks Do not use for split/focus/week filtering; only exercise names are matched.
 */
export function filterPlanWeeksByExerciseName(
  weeks: PlanWeek[],
  query: string,
): PlanWeek[] {
  const normalized = query.trim().toLowerCase();

  /* Empty (or whitespace-only) query: complete, unfiltered view.
     Returning the original reference keeps the fast path allocation-free. */
  if (normalized.length === 0) {
    return weeks;
  }

  return weeks
    .map((week) => {
      const days = week.days
        .map((day): PlanDay | null => {
          const exercises = day.exercises.filter((exercise) =>
            exercise.name.toLowerCase().includes(normalized),
          );
          /* Omit days with no matching exercises. */
          return exercises.length > 0 ? { ...day, exercises } : null;
        })
        .filter((day): day is PlanDay => day !== null);

      /* Omit weeks left with no remaining days. */
      return days.length > 0 ? { ...week, days } : null;
    })
    .filter((week): week is PlanWeek => week !== null);
}

/**
 * Builds the onboarding generate-plan wire payload.
 * @param profile Active user profile to send.
 * @param goals Selected goal ids in arbitrary click order.
 * @param hardware Ordered hardware source ids from feature config.
 * @param lifestyle Optional lifestyle override merged into the profile payload;
 *   omitting it sends the profile's own `lifestyle` field unchanged.
 * @param orthopedic Optional orthopedic selection merged into the profile payload
 *   and the top-level `caution`; omitting it sends the profile's own fields unchanged.
 * @param onboarding Optional required-field patch (biometrics, experience tier)
 *   applied to the profile payload LAST; omitting it sends the profile's own
 *   biometrics/experienceTier unchanged.
 * @returns New request object with canonicalized goals and copied arrays.
 * @remarks Do not pass this for re-compose; use RecomposePlanRequest there.
 */
export function buildGeneratePlanRequest(
  profile: UserProfile,
  goals: readonly TrainingGoalId[],
  hardware: readonly string[],
  lifestyle?: LifestyleProfile,
  orthopedic?: OrthopedicSelection,
  onboarding?: GenerateProfilePatch,
): GeneratePlanRequest {
  const uniqueGoals = new Set<TrainingGoalId>(goals);
  const canonicalGoals = TRAINING_GOAL_IDS.filter((goal) => uniqueGoals.has(goal));

  // WHY: single expression feeds request.caution AND the merged profile payload,
  // so the two wire copies cannot drift (plan assumption A3).
  const caution = orthopedic?.caution ?? profile.caution;

  let nextProfile: UserProfile = profile;
  if (orthopedic) {
    const uniqueLimitations = new Set<OrthopedicLimitationId>(orthopedic.limitations);
    const canonicalLimitations = ORTHOPEDIC_LIMITATION_IDS.filter((id) =>
      uniqueLimitations.has(id),
    );
    // WHY: no-override path must keep the identical profile reference so callers
    // can assert request identity/back-compat; only merge a new object when overridden.
    nextProfile = { ...nextProfile, orthopedicLimitations: canonicalLimitations, caution };
  }
  if (lifestyle) {
    nextProfile = { ...nextProfile, lifestyle };
  }
  // WHY: null is a meaningful explicit value (required onboarding field
  // incomplete), so the guard is !== undefined, never truthiness — an explicit
  // null must clear the field in the payload.
  if (onboarding?.biometrics !== undefined) {
    nextProfile = { ...nextProfile, biometrics: onboarding.biometrics };
  }
  if (onboarding?.experienceTier !== undefined) {
    nextProfile = { ...nextProfile, experienceTier: onboarding.experienceTier };
  }

  return {
    profile: nextProfile,
    goals: [...canonicalGoals],
    hardware: [...hardware],
    caution,
  };
}
