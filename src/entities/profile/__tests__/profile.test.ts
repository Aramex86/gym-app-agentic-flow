/* entities/profile — pure node tests for the selector truth table, the
   biometrics validation truth table, the experience-tier constants and the
   in-memory profile store (no DOM, repo default environment). */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { UserProfile } from "../types";
import {
  BIOMETRIC_FIELDS,
  BIOMETRIC_RANGES,
  DAILY_ACTIVITY_IDS,
  DEFAULT_LIFESTYLE_PROFILE,
  DEFAULT_ONBOARDING_PROFILE,
  DEFAULT_ORTHOPEDIC_PROFILE,
  EMPTY_BIOMETRICS_DRAFT,
  EXPERIENCE_TIER_IDS,
  EXPERIENCE_VOLUME_MULTIPLIERS,
  ORTHOPEDIC_LIMITATION_IDS,
  SLEEP_DURATION_IDS,
  STRESS_LEVEL_IDS,
  getActiveProfile,
  getExperienceVolumeMultiplier,
  hasHealthConditions,
  isBiometricsComplete,
  resetActiveProfile,
  saveActiveProfile,
  toBiometrics,
  toBiometricsDraft,
  validateBiometrics,
} from "../index";

function makeProfile(overrides: Partial<UserProfile>): UserProfile {
  return {
    id: "test",
    name: "Test user",
    diseases: [],
    physicalProblems: [],
    lifestyle: DEFAULT_LIFESTYLE_PROFILE,
    ...DEFAULT_ONBOARDING_PROFILE,
    ...DEFAULT_ORTHOPEDIC_PROFILE,
    ...overrides,
  };
}

beforeEach(() => {
  // WHY: storedProfile is module-global; start each test from the first run.
  resetActiveProfile();
});

afterEach(() => {
  resetActiveProfile();
});

describe("entities/profile — getActiveProfile", () => {
  it("returns a profile with diseases and physicalProblems arrays", () => {
    const profile = getActiveProfile();
    expect(Array.isArray(profile.diseases)).toBe(true);
    expect(Array.isArray(profile.physicalProblems)).toBe(true);
  });

  it("default fixture is healthy (basic variant on the live plan screen)", () => {
    expect(getActiveProfile().diseases).toEqual([]);
    expect(getActiveProfile().physicalProblems).toEqual([]);
  });

  it("active profile opens on moderate lifestyle defaults", () => {
    expect(getActiveProfile().lifestyle).toEqual({
      sleepDuration: "7-8",
      dailyActivity: "moderate",
      stressLevel: "moderate",
    });
  });

  it("first-run profile has null biometrics and null experience tier (A3)", () => {
    expect(getActiveProfile().biometrics).toBeNull();
    expect(getActiveProfile().experienceTier).toBeNull();
  });

  it("active profile opens on skippable orthopedic defaults (no tags, no caution)", () => {
    expect(getActiveProfile().orthopedicLimitations).toEqual([]);
    expect(getActiveProfile().caution).toBe("");
  });

  it("canonical orthopedic limitation ids are UI-ordered", () => {
    expect([...ORTHOPEDIC_LIMITATION_IDS]).toEqual([
      "knee",
      "lower-back",
      "shoulder",
      "wrist",
      "custom",
    ]);
  });

  it("every DEFAULT_LIFESTYLE_PROFILE value is a member of its canonical id tuple", () => {
    expect(SLEEP_DURATION_IDS).toContain(DEFAULT_LIFESTYLE_PROFILE.sleepDuration);
    expect(DAILY_ACTIVITY_IDS).toContain(DEFAULT_LIFESTYLE_PROFILE.dailyActivity);
    expect(STRESS_LEVEL_IDS).toContain(DEFAULT_LIFESTYLE_PROFILE.stressLevel);
  });

  it("DEFAULT_ORTHOPEDIC_PROFILE is the skippable empty shape", () => {
    expect(DEFAULT_ORTHOPEDIC_PROFILE.orthopedicLimitations).toEqual([]);
    expect(DEFAULT_ORTHOPEDIC_PROFILE.caution).toBe("");
  });

  it("DEFAULT_ONBOARDING_PROFILE is the unanswered required-field shape", () => {
    expect(DEFAULT_ONBOARDING_PROFILE).toEqual({ biometrics: null, experienceTier: null });
  });
});

describe("entities/profile — hasHealthConditions truth table", () => {
  it("disease declared -> true", () => {
    expect(
      hasHealthConditions(makeProfile({ diseases: ["asthma"], physicalProblems: [] })),
    ).toBe(true);
  });

  it("physical problem declared -> true", () => {
    expect(
      hasHealthConditions(makeProfile({ diseases: [], physicalProblems: ["knee injury"] })),
    ).toBe(true);
  });

  it("healthy profile (both empty) -> false", () => {
    expect(hasHealthConditions(makeProfile({}))).toBe(false);
  });
});

describe("entities/profile — validateBiometrics truth table", () => {
  it("BIOMETRIC_FIELDS order is canonical (age -> height -> weight)", () => {
    expect([...BIOMETRIC_FIELDS]).toEqual(["ageYears", "heightCm", "weightKg"]);
  });

  it("empty draft -> three required issues in canonical field order", () => {
    const issues = validateBiometrics(EMPTY_BIOMETRICS_DRAFT);
    expect(issues).toEqual([
      { field: "ageYears", code: "required" },
      { field: "heightCm", code: "required" },
      { field: "weightKg", code: "required" },
    ]);
  });

  it("whitespace-only text counts as required", () => {
    expect(validateBiometrics({ ageYears: "  ", heightCm: "170", weightKg: "70" })).toEqual([
      { field: "ageYears", code: "required" },
    ]);
  });

  it("non-numeric text -> not-a-number", () => {
    expect(
      validateBiometrics({ ageYears: "abc", heightCm: "178", weightKg: "75" }),
    ).toEqual([{ field: "ageYears", code: "not-a-number" }]);
  });

  it("decimal age -> not-an-integer (whole-year range)", () => {
    expect(
      validateBiometrics({ ageYears: "30.5", heightCm: "178", weightKg: "75" }),
    ).toEqual([{ field: "ageYears", code: "not-an-integer" }]);
  });

  it("decimal height -> not-an-integer (whole-cm range)", () => {
    expect(
      validateBiometrics({ ageYears: "30", heightCm: "178.5", weightKg: "75" }),
    ).toEqual([{ field: "heightCm", code: "not-an-integer" }]);
  });

  it.each([
    { field: "ageYears", raw: "12" },
    { field: "ageYears", raw: "101" },
    { field: "heightCm", raw: "119" },
    { field: "heightCm", raw: "251" },
    { field: "weightKg", raw: "29" },
    { field: "weightKg", raw: "301" },
  ] as const)("one out-of-range value per field ($field = $raw)", ({ field, raw }) => {
    const draft = { ageYears: "30", heightCm: "178", weightKg: "75" };
    draft[field] = raw;
    expect(validateBiometrics(draft)).toEqual([{ field, code: "out-of-range" }]);
  });

  it("canonical ranges are the accepted A2 table", () => {
    expect(BIOMETRIC_RANGES.ageYears).toEqual({ min: 13, max: 100, integer: true, unit: "years" });
    expect(BIOMETRIC_RANGES.heightCm).toEqual({ min: 120, max: 250, integer: true, unit: "cm" });
    expect(BIOMETRIC_RANGES.weightKg).toEqual({ min: 30, max: 300, integer: false, unit: "kg" });
  });

  it("valid draft incl. decimal weight -> no issues", () => {
    expect(validateBiometrics({ ageYears: "30", heightCm: "178", weightKg: "75.5" })).toEqual([]);
  });

  it("boundary values are accepted (min/max inclusive)", () => {
    expect(validateBiometrics({ ageYears: "13", heightCm: "120", weightKg: "30" })).toEqual([]);
    expect(validateBiometrics({ ageYears: "100", heightCm: "250", weightKg: "300" })).toEqual([]);
  });

  it("mixed draft keeps one issue per field in canonical order", () => {
    expect(
      validateBiometrics({ ageYears: "abc", heightCm: "", weightKg: "75" }),
    ).toEqual([
      { field: "ageYears", code: "not-a-number" },
      { field: "heightCm", code: "required" },
    ]);
  });
});

describe("entities/profile — isBiometricsComplete / toBiometrics / toBiometricsDraft", () => {
  it("complete mirrors the empty issues list", () => {
    expect(isBiometricsComplete(EMPTY_BIOMETRICS_DRAFT)).toBe(false);
    expect(isBiometricsComplete({ ageYears: "30", heightCm: "178", weightKg: "75.5" })).toBe(true);
  });

  it("toBiometrics normalizes a valid draft to numbers", () => {
    expect(toBiometrics({ ageYears: "30", heightCm: "178", weightKg: "75.5" })).toEqual({
      ageYears: 30,
      heightCm: 178,
      weightKg: 75.5,
    });
  });

  it("toBiometrics returns null when any field is invalid", () => {
    expect(toBiometrics(EMPTY_BIOMETRICS_DRAFT)).toBeNull();
    expect(toBiometrics({ ageYears: "30", heightCm: "", weightKg: "75" })).toBeNull();
    expect(toBiometrics({ ageYears: "abc", heightCm: "178", weightKg: "75" })).toBeNull();
    expect(toBiometrics({ ageYears: "105", heightCm: "178", weightKg: "75" })).toBeNull();
  });

  it("toBiometricsDraft(null) returns a fresh empty draft, not the shared constant", () => {
    const draft = toBiometricsDraft(null);
    expect(draft).toEqual(EMPTY_BIOMETRICS_DRAFT);
    expect(draft).not.toBe(EMPTY_BIOMETRICS_DRAFT);
    draft.ageYears = "mutated";
    expect(EMPTY_BIOMETRICS_DRAFT.ageYears).toBe("");
  });

  it("toBiometricsDraft round-trips stored biometrics to strings", () => {
    const draft = toBiometricsDraft({ ageYears: 30, heightCm: 178, weightKg: 75.5 });
    expect(draft).toEqual({ ageYears: "30", heightCm: "178", weightKg: "75.5" });
    expect(toBiometrics(draft)).toEqual({ ageYears: 30, heightCm: 178, weightKg: 75.5 });
  });
});

describe("entities/profile — experience tiers (A4)", () => {
  it("tier ids are canonical and ordered low -> high", () => {
    expect([...EXPERIENCE_TIER_IDS]).toEqual(["novice", "intermediate", "advanced"]);
  });

  it("multipliers are the canonical 0.8 / 1 / 1.2 table", () => {
    expect(EXPERIENCE_VOLUME_MULTIPLIERS).toEqual({
      novice: 0.8,
      intermediate: 1,
      advanced: 1.2,
    });
  });

  it.each([
    ["novice", 0.8],
    ["intermediate", 1],
    ["advanced", 1.2],
  ] as const)("getExperienceVolumeMultiplier(%s) -> %s", (tier, expected) => {
    expect(getExperienceVolumeMultiplier(tier)).toBe(expected);
  });
});

describe("entities/profile — in-memory profile store (A5)", () => {
  it("first run: getActiveProfile returns the first-run fixture with nulls", () => {
    const profile = getActiveProfile();
    expect(profile.biometrics).toBeNull();
    expect(profile.experienceTier).toBeNull();
  });

  it("saveActiveProfile persists; getActiveProfile returns the stored profile", () => {
    const profile = makeProfile({
      biometrics: { ageYears: 30, heightCm: 178, weightKg: 75 },
      experienceTier: "intermediate",
    });
    saveActiveProfile(profile);
    expect(getActiveProfile()).toBe(profile);
  });

  it("a second save replaces the stored profile", () => {
    const first = makeProfile({ experienceTier: "novice" });
    const second = makeProfile({ experienceTier: "advanced" });
    saveActiveProfile(first);
    saveActiveProfile(second);
    expect(getActiveProfile()).toBe(second);
  });

  it("resetActiveProfile restores the first-run nulls", () => {
    saveActiveProfile(
      makeProfile({ biometrics: { ageYears: 30, heightCm: 178, weightKg: 75 } }),
    );
    resetActiveProfile();
    expect(getActiveProfile().biometrics).toBeNull();
    expect(getActiveProfile().experienceTier).toBeNull();
  });
});
