/* entities/profile — data access. Synchronous accessor over the static
   active profile: same pattern as entities/training-plan/api.ts, no async
   or loading surface, so features render in one pass. A real profile
   source later swaps THIS file only — the entity and feature APIs above
   it do not change. */

import type { UserProfile } from "./types";
import { DEFAULT_LIFESTYLE_PROFILE, DEFAULT_ORTHOPEDIC_PROFILE } from "./types";

// WHY: no profile source exists in this worktree yet; the default fixture is
// healthy AND moderate on lifestyle AND skippable-empty on orthopedics, so the
// live plan screen shows the "basic" banner, onboarding opens on the moderate
// defaults and getActiveProfile() stays the single swap point for a future source.
const ACTIVE_PROFILE: UserProfile = {
  id: "profile-active",
  name: "Active user",
  diseases: [],
  physicalProblems: [],
  lifestyle: DEFAULT_LIFESTYLE_PROFILE,
  ...DEFAULT_ORTHOPEDIC_PROFILE,
};

export function getActiveProfile(): UserProfile {
  return ACTIVE_PROFILE;
}
