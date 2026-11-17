/* shared/config activePlan — module-store tests. */

import { describe, expect, it } from "vitest";
import { SAMPLE_PLAN } from "../plan.sample";
import { getActivePlan, resetActivePlan, setActivePlan } from "../activePlan";

describe("shared/config activePlan", () => {
  it("starts as null", () => {
    resetActivePlan();
    expect(getActivePlan()).toBeNull();
  });

  it("returns the same reference after set", () => {
    resetActivePlan();
    setActivePlan(SAMPLE_PLAN);
    expect(getActivePlan()).toBe(SAMPLE_PLAN);
  });

  it("returns to null after reset", () => {
    setActivePlan(SAMPLE_PLAN);
    resetActivePlan();
    expect(getActivePlan()).toBeNull();
  });
});
