/* features/plan-disclaimer — scenario: the ADR-0001 D4 medical disclaimer
   wired onto the plan screen. Presentation mapping ONLY: read the active
   profile from @entities/profile (static, synchronous — no fetch, per the
   AGENTS.md data rule), pick the banner variant, render the shared
   DisclaimerBanner atom from @shared/ui. No feature-to-feature imports;
   no business logic beyond the variant mapping (that lives in the
   entity's slice). */

import type { JSX } from "react";
import type { UserProfile } from "@entities/profile";
import { getActiveProfile, hasHealthConditions } from "@entities/profile";
import { DisclaimerBanner } from "@shared/ui";

export interface PlanDisclaimerProps {
  /** Optional override used by tests; production reads the active profile. */
  profile?: UserProfile;
}

export function PlanDisclaimer({ profile }: PlanDisclaimerProps): JSX.Element {
  const activeProfile = profile ?? getActiveProfile();
  const variant = hasHealthConditions(activeProfile) ? "disease" : "basic";

  return <DisclaimerBanner variant={variant} />;
}
