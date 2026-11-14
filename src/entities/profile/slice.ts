/* entities/profile — state / business logic. Pure selectors, no I/O. */

import type { UserProfile } from "./types";

/** True when the user declared any disease or physical problem — the
    condition that upgrades the plan disclaimer to the doctor-warning
    variant (ADR-0001 D4). */
export function hasHealthConditions(profile: UserProfile): boolean {
  return profile.diseases.length > 0 || profile.physicalProblems.length > 0;
}
