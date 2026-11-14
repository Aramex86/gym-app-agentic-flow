/* entities/profile — pure node tests for the selector truth table and the
   active-profile fixture shape (no DOM, repo default environment). */

import { describe, expect, it } from "vitest";
import type { UserProfile } from "../types";
import { getActiveProfile, hasHealthConditions } from "../index";

function makeProfile(overrides: Partial<UserProfile>): UserProfile {
  return { id: "test", name: "Test user", diseases: [], physicalProblems: [], ...overrides };
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
