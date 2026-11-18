/* entities/profile — pure node tests for the selector truth table and the
   active-profile fixture shape (no DOM, repo default environment). */

import { describe, expect, it } from "vitest";
import type { UserProfile } from "../types";
import {
  DAILY_ACTIVITY_IDS,
  DEFAULT_LIFESTYLE_PROFILE,
  SLEEP_DURATION_IDS,
  STRESS_LEVEL_IDS,
  getActiveProfile,
  hasHealthConditions,
} from "../index";

function makeProfile(overrides: Partial<UserProfile>): UserProfile {
  return {
    id: "test",
    name: "Test user",
    diseases: [],
    physicalProblems: [],
    lifestyle: DEFAULT_LIFESTYLE_PROFILE,
    ...overrides,
  };
}

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

  it("every DEFAULT_LIFESTYLE_PROFILE value is a member of its canonical id tuple", () => {
    expect(SLEEP_DURATION_IDS).toContain(DEFAULT_LIFESTYLE_PROFILE.sleepDuration);
    expect(DAILY_ACTIVITY_IDS).toContain(DEFAULT_LIFESTYLE_PROFILE.dailyActivity);
    expect(STRESS_LEVEL_IDS).toContain(DEFAULT_LIFESTYLE_PROFILE.stressLevel);
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
