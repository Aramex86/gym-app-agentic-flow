/* features/plan-disclaimer — node-safe SSR test. Variant selection is
   pinned via injected profile fixtures (production has no profile source
   with conditions yet — plan A3; the entity truth table is covered by
   src/entities/profile/__tests__/profile.test.ts). */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import type { UserProfile } from "@entities/profile";
// WHY: plan 9e — UserProfile gained a required lifestyle field; plan
// onboarding-orthopedic (A3) added required orthopedicLimitations/caution
// fields. Fixtures add only the skippable defaults so disclaimer behavior is
// unchanged (ADR-0001 D4).
import {
  DEFAULT_LIFESTYLE_PROFILE,
  DEFAULT_ORTHOPEDIC_PROFILE,
  getActiveProfile,
  hasHealthConditions,
} from "@entities/profile";
import { PlanDisclaimer } from "../ui/PlanDisclaimer";

const BASE_LINE =
  "This plan is not medical advice. Stop and consult a professional if pain occurs.";
const DOCTOR_LINE =
  "You listed health conditions in your profile. Consult a doctor before starting this plan.";

function render(element: ReactElement): string {
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("features/plan-disclaimer — variant selection", () => {
  it("healthy profile -> basic: base line present, doctor line absent", () => {
    const html = render(
      <PlanDisclaimer
        profile={{
          id: "t",
          name: "T",
          diseases: [],
          physicalProblems: [],
          lifestyle: DEFAULT_LIFESTYLE_PROFILE,
          ...DEFAULT_ORTHOPEDIC_PROFILE,
        }}
      />,
    );
    expect(html).toContain(BASE_LINE);
    expect(html).not.toContain(DOCTOR_LINE);
  });

  it("profile with a disease -> disease: doctor line and base line present", () => {
    const html = render(
      <PlanDisclaimer
        profile={{ id: "t", name: "T", diseases: ["asthma"], physicalProblems: [], lifestyle: DEFAULT_LIFESTYLE_PROFILE, ...DEFAULT_ORTHOPEDIC_PROFILE }}
      />,
    );
    expect(html).toContain(DOCTOR_LINE);
    expect(html).toContain(BASE_LINE);
  });

  it("profile with a physical problem -> disease path too", () => {
    const html = render(
      <PlanDisclaimer
        profile={{ id: "t", name: "T", diseases: [], physicalProblems: ["knee injury"], lifestyle: DEFAULT_LIFESTYLE_PROFILE, ...DEFAULT_ORTHOPEDIC_PROFILE }}
      />,
    );
    expect(html).toContain(DOCTOR_LINE);
  });

  it("no profile prop -> falls back to the active profile (healthy fixture -> basic)", () => {
    expect(hasHealthConditions(getActiveProfile())).toBe(false);
    const html = render(<PlanDisclaimer />);
    expect(html).toContain(BASE_LINE);
    expect(html).not.toContain(DOCTOR_LINE);
  });
});
