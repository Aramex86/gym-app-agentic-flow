/* entities/training-plan — pure filter tests (node-safe, no DOM):
   row counts, name-only matching, hierarchy cleanup, ordering and
   immutability of the static plan. Counts are pinned from
   docs/contracts/plan-schema.md §6 (4 weeks x 2 days x 5 exercises). */

import { describe, expect, it } from "vitest";
import { SAMPLE_PLAN } from "@shared/config/plan.sample";
import type { PlanWeek } from "@shared/config/plan.schema";
import { getActiveProfile } from "@entities/profile";
import type { LifestyleProfile } from "@entities/profile";
import { ORTHOPEDIC_LIMITATION_IDS } from "@entities/profile";
import type { GenerateProfilePatch, OrthopedicSelection, TrainingGoalId } from "../types";
import { TRAINING_GOAL_IDS } from "../types";
import { buildGeneratePlanRequest, filterPlanWeeksByExerciseName } from "../slice";

const weeks = SAMPLE_PLAN.weeks;

function rowCount(filtered: PlanWeek[]): number {
  return filtered
    .flatMap((week) => week.days)
    .flatMap((day) => day.exercises).length;
}

describe("entities/training-plan filterPlanWeeksByExerciseName", () => {
  it("empty query returns all rows and the original array reference", () => {
    expect(filterPlanWeeksByExerciseName(weeks, "")).toBe(weeks);
    expect(rowCount(filterPlanWeeksByExerciseName(weeks, ""))).toBe(40);
  });

  it("whitespace-only query returns all rows and the original reference", () => {
    expect(filterPlanWeeksByExerciseName(weeks, "   ")).toBe(weeks);
    expect(rowCount(filterPlanWeeksByExerciseName(weeks, "   "))).toBe(40);
  });

  it.each([
    ["  back squat  "],
    ["BACK SQUAT"],
  ])("trims and case-folds the query (%j) to exactly four Back Squat rows", (query) => {
    const filtered = filterPlanWeeksByExerciseName(weeks, query);

    expect(rowCount(filtered)).toBe(4);
    const names = filtered
      .flatMap((week) => week.days)
      .flatMap((day) => day.exercises.map((exercise) => exercise.name));
    expect(names).toEqual(["Back Squat", "Back Squat", "Back Squat", "Back Squat"]);
  });

  it("a split-only term matches no rows (exercise names are the search target)", () => {
    const filtered = filterPlanWeeksByExerciseName(weeks, "Upper");
    expect(filtered).toEqual([]);
  });

  it('"press" matches all and only names containing it (16 rows: 4 names x 4 weeks)', () => {
    const filtered = filterPlanWeeksByExerciseName(weeks, "press");
    expect(rowCount(filtered)).toBe(16);

    const exercises = filtered
      .flatMap((week) => week.days)
      .flatMap((day) => day.exercises);
    for (const exercise of exercises) {
      expect(exercise.name.toLowerCase()).toContain("press");
    }
    expect(new Set(exercises.map((exercise) => exercise.name))).toEqual(
      new Set([
        "Barbell Bench Press",
        "Incline Dumbbell Press",
        "Seated Dumbbell Shoulder Press",
        "Leg Press",
      ]),
    );
  });

  it("an unmatched term returns an empty array", () => {
    expect(filterPlanWeeksByExerciseName(weeks, "burpee")).toEqual([]);
  });

  it("keeps original week/day ordering, week numbers, day numbers and exercise ids", () => {
    const filtered = filterPlanWeeksByExerciseName(weeks, "squat");

    // Week order/numbers preserved, no reordering.
    expect(filtered.map((week) => week.week)).toEqual(weeks.map((week) => week.week));
    // Day order/numbers preserved inside each surviving week.
    expect(filtered.map((week) => week.days.map((day) => day.day))).toEqual(
      [[2], [2], [2], [2]],
    );

    // Exercise ids are the original sample ids, in original order within a day.
    const sampleIds = weeks[0].days[1].exercises.map((exercise) => exercise.id);
    expect(filtered[0].days[0].exercises.map((exercise) => exercise.id)).toEqual(
      sampleIds.filter((id) => id.includes("squat")),
    );

    // No empty day/week buckets survive.
    for (const week of filtered) {
      expect(week.days.length).toBeGreaterThan(0);
      for (const day of week.days) {
        expect(day.exercises.length).toBeGreaterThan(0);
      }
    }
  });

  it("filtered projection keeps original week focus metadata", () => {
    const filtered = filterPlanWeeksByExerciseName(weeks, "squat");
    expect(filtered.map((week) => week.focus)).toEqual(
      weeks.map((week) => week.focus),
    );
  });

  it("never mutates the input hierarchy (deep-frozen fixture stays frozen and intact)", () => {
    /* Small nested fixture, frozen deeply: filtering must not throw a
       strict-mode write error and must leave the snapshot untouched. */
    const fixture = [
      {
        week: 1,
        focus: "Fixture",
        days: [
          {
            day: 1,
            split: "Upper",
            exercises: [
              { id: "w1d1e1", name: "Back Squat", sets: 5, reps: 5, rpe: 7, restSec: 180 },
              { id: "w1d1e2", name: "Leg Press", sets: 3, reps: 12, rpe: 7, restSec: 90 },
            ],
          },
          {
            day: 2,
            split: "Lower",
            exercises: [
              { id: "w1d2e1", name: "Barbell Bench Press", sets: 4, reps: 8, rpe: 7, restSec: 120 },
            ],
          },
        ],
      },
    ] as PlanWeek[];
    const snapshot = JSON.stringify(fixture);

    const deepFreeze = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(deepFreeze);
      } else if (typeof value === "object" && value !== null) {
        Object.values(value as Record<string, unknown>).forEach(deepFreeze);
        Object.freeze(value as Record<string, unknown>);
      }
    };
    deepFreeze(fixture);

    const matched = filterPlanWeeksByExerciseName(fixture, "squat");
    const unmatched = filterPlanWeeksByExerciseName(fixture, "nope");

    expect(JSON.stringify(fixture)).toBe(snapshot);
    expect(fixture).toEqual(JSON.parse(snapshot));
    expect(rowCount(matched)).toBe(1);
    expect(unmatched).toEqual([]);
  });
});

describe("entities/training-plan buildGeneratePlanRequest", () => {
  it("orders goals canonically and removes duplicates", () => {
    const request = buildGeneratePlanRequest(
      getActiveProfile(),
      ["mobility", "strength", "mobility"],
      ["heart-rate-strap", "smart-watch"],
    );
    expect(request.goals).toEqual(["strength", "mobility"]);
    expect(request.goals).toEqual(
      TRAINING_GOAL_IDS.filter((goal) => ["mobility", "strength"].includes(goal)),
    );
  });

  it("keeps profile reference and hardware order", () => {
    const profile = getActiveProfile();
    const hardware = ["phone-logger", "heart-rate-strap", "smart-watch"] as const;
    const request = buildGeneratePlanRequest(profile, ["strength"], hardware);
    expect(request.profile).toBe(profile);
    expect(request.hardware).toEqual([...hardware]);
  });

  it("does not mutate goal or hardware input arrays", () => {
    const goals = ["mobility", "strength", "strength"] as ("mobility" | "strength")[];
    const hardware = ["heart-rate-strap", "smart-watch"];
    const goalsBefore = [...goals];
    const hardwareBefore = [...hardware];

    const request = buildGeneratePlanRequest(getActiveProfile(), goals, hardware);

    expect(goals).toEqual(goalsBefore);
    expect(hardware).toEqual(hardwareBefore);
    expect(request.goals).not.toBe(goals);
    expect(request.hardware).not.toBe(hardware);
  });

  it("returns goals: [] for empty input", () => {
    const request = buildGeneratePlanRequest(
      getActiveProfile(),
      [],
      ["heart-rate-strap", "smart-watch"],
    );
    expect(request.goals).toEqual([]);
  });

  it("no lifestyle override -> profile's own lifestyle is sent (reference kept)", () => {
    const profile = getActiveProfile();
    const request = buildGeneratePlanRequest(profile, ["strength"], ["smart-watch"]);
    expect(request.profile.lifestyle).toEqual(profile.lifestyle);
  });

  it("lifestyle override -> new profile object with the override, base never mutated", () => {
    const profile = getActiveProfile();
    const override: LifestyleProfile = {
      sleepDuration: "under-6",
      dailyActivity: "high",
      stressLevel: "low",
    };

    const request = buildGeneratePlanRequest(profile, ["strength"], ["smart-watch"], override);

    expect(request.profile).not.toBe(profile);
    expect(request.profile.lifestyle).toEqual(override);
    // Canonical goal guarantee still holds with the override.
    expect(request.goals).toEqual(["strength"]);
    // No mutation of the base profile.
    expect(profile.lifestyle).toEqual({
      sleepDuration: "7-8",
      dailyActivity: "moderate",
      stressLevel: "moderate",
    });
  });

  it("no orthopedic override -> request.caution comes from the profile and the profile reference is preserved", () => {
    const profile = { ...getActiveProfile(), caution: "  keep me  ", orthopedicLimitations: ["knee"] as const };
    const request = buildGeneratePlanRequest(profile, ["strength"], ["smart-watch"]);
    expect(request.caution).toBe(profile.caution);
    expect(request.profile).toBe(profile);
    expect(request.profile.orthopedicLimitations).toBe(profile.orthopedicLimitations);
  });

  it("orthopedic override -> limitations are deduped and re-ordered canonically", () => {
    const profile = getActiveProfile();
    const selection: OrthopedicSelection = {
      limitations: ["wrist", "knee", "wrist"],
      caution: "",
    };

    const request = buildGeneratePlanRequest(profile, ["strength"], ["smart-watch"], undefined, selection);

    expect(request.profile.orthopedicLimitations).toEqual(["knee", "wrist"]);
    expect(request.profile.orthopedicLimitations).toEqual(
      ORTHOPEDIC_LIMITATION_IDS.filter((id) => new Set(["wrist", "knee"]).has(id)),
    );
  });

  it("orthopedic override -> new profile object, base never mutated, values carried in the payload", () => {
    const profile = getActiveProfile();
    const selection: OrthopedicSelection = {
      limitations: ["lower-back", "shoulder"],
      caution: "No overhead press",
    };

    const request = buildGeneratePlanRequest(profile, ["strength"], ["smart-watch"], undefined, selection);

    expect(request.profile).not.toBe(profile);
    expect(profile.orthopedicLimitations).toEqual([]);
    expect(profile.caution).toBe("");
    expect(request.profile.orthopedicLimitations).toEqual(["lower-back", "shoulder"]);
    expect(request.profile.caution).toBe("No overhead press");
    expect(request.caution).toBe("No overhead press");
  });

  it("orthopedic caution is copied verbatim (no trim, no slice, no normalization)", () => {
    const profile = getActiveProfile();
    const raw = "  leading and trailing spaces kept  ";
    const request = buildGeneratePlanRequest(
      profile,
      ["strength"],
      ["smart-watch"],
      undefined,
      { limitations: [], caution: raw },
    );
    expect(request.caution).toBe(raw);
    expect(request.profile.caution).toBe(raw);
  });

  it("lifestyle + orthopedic overrides together survive in one profile object", () => {
    const profile = getActiveProfile();
    const lifestyle: LifestyleProfile = {
      sleepDuration: "6-7",
      dailyActivity: "light",
      stressLevel: "high",
    };

    const request = buildGeneratePlanRequest(
      profile,
      ["mobility", "strength", "mobility"],
      ["smart-watch"],
      lifestyle,
      { limitations: ["wrist", "knee"], caution: "gentle wrist loading" },
    );

    expect(request.profile).not.toBe(profile);
    expect(request.profile.lifestyle).toEqual(lifestyle);
    expect(request.profile.orthopedicLimitations).toEqual(["knee", "wrist"]);
    expect(request.profile.caution).toBe("gentle wrist loading");
    expect(request.caution).toBe("gentle wrist loading");
    expect(request.goals).toEqual(["strength", "mobility"]);
  });
});

describe("entities/training-plan buildGeneratePlanRequest — onboarding patch", () => {
  it("merges biometrics + experienceTier into request.profile; base profile not mutated", () => {
    const profile = getActiveProfile();
    const patch: GenerateProfilePatch = {
      biometrics: { ageYears: 30, heightCm: 178, weightKg: 75.5 },
      experienceTier: "advanced",
    };

    const request = buildGeneratePlanRequest(
      profile,
      ["strength"],
      ["smart-watch"],
      undefined,
      undefined,
      patch,
    );

    expect(request.profile).not.toBe(profile);
    expect(request.profile.biometrics).toEqual({ ageYears: 30, heightCm: 178, weightKg: 75.5 });
    expect(request.profile.experienceTier).toBe("advanced");
    expect(profile.biometrics).toBeNull();
    expect(profile.experienceTier).toBeNull();
  });

  it("explicit null patch values clear the fields in the payload (guard is !== undefined)", () => {
    const profile = {
      ...getActiveProfile(),
      biometrics: { ageYears: 30, heightCm: 178, weightKg: 75 } as const,
      experienceTier: "novice" as const,
    };
    const request = buildGeneratePlanRequest(
      profile,
      ["strength"],
      ["smart-watch"],
      undefined,
      undefined,
      { biometrics: null, experienceTier: null },
    );

    expect(request.profile.biometrics).toBeNull();
    expect(request.profile.experienceTier).toBeNull();
    // The explicit nulls survive JSON serialization (never dropped keys).
    expect(JSON.parse(JSON.stringify(request.profile))).toHaveProperty("biometrics", null);
    expect(JSON.parse(JSON.stringify(request.profile))).toHaveProperty("experienceTier", null);
    // Base profile not mutated.
    expect(profile.biometrics).not.toBeNull();
  });

  it("no patch (undefined) keeps the original profile reference exactly as today", () => {
    const profile = getActiveProfile();
    const request = buildGeneratePlanRequest(profile, ["strength"], ["smart-watch"]);
    expect(request.profile).toBe(profile);
  });

  it("one-key patches only touch their own key; the other keeps the profile value", () => {
    const profile = {
      ...getActiveProfile(),
      biometrics: { ageYears: 22, heightCm: 165, weightKg: 55 } as const,
      experienceTier: "novice" as const,
    };
    const request = buildGeneratePlanRequest(
      profile,
      ["strength"],
      ["smart-watch"],
      undefined,
      undefined,
      { biometrics: undefined, experienceTier: "advanced" },
    );

    expect(request.profile.biometrics).toBe(profile.biometrics);
    expect(request.profile.experienceTier).toBe("advanced");
  });

  it("patch combines with lifestyle + orthopedic overrides in one profile object", () => {
    const profile = getActiveProfile();
    const lifestyle: LifestyleProfile = {
      sleepDuration: "under-6",
      dailyActivity: "high",
      stressLevel: "low",
    };

    const request = buildGeneratePlanRequest(
      profile,
      ["strength"],
      ["smart-watch"],
      lifestyle,
      { limitations: ["knee"], caution: "gentle knee" },
      { biometrics: { ageYears: 25, heightCm: 180, weightKg: 80 }, experienceTier: "novice" },
    );

    expect(request.profile).not.toBe(profile);
    expect(request.profile.lifestyle).toEqual(lifestyle);
    expect(request.profile.orthopedicLimitations).toEqual(["knee"]);
    expect(request.profile.caution).toBe("gentle knee");
    expect(request.profile.biometrics).toEqual({ ageYears: 25, heightCm: 180, weightKg: 80 });
    expect(request.profile.experienceTier).toBe("novice");
    // The multiplier never rides the wire — only the tier id does (A4).
    expect(JSON.parse(JSON.stringify(request))).not.toContain("0.8");
    expect(JSON.parse(JSON.stringify(request))).not.toContain("multiplier");
  });
});
