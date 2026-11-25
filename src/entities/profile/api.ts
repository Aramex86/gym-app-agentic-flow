/* entities/profile — data access. Synchronous accessor over the active
   profile: in-memory store first (persisted on successful generation by
   saveActiveProfile), then the first-run fixture. No browser storage and no
   async surface (ADR-0005): the store resets on reload, so a real profile
   source later swaps THIS file only — the entity and feature APIs above it
   do not change. */

import type { UserProfile } from "./types";
import {
  DEFAULT_LIFESTYLE_PROFILE,
  DEFAULT_ONBOARDING_PROFILE,
  DEFAULT_ORTHOPEDIC_PROFILE,
} from "./types";
import { getStoredProfile, persistProfile } from "./slice";

// WHY: the first-run fixture carries null biometrics/tier (required onboarding
// fields gate the Generate CTA until answered) AND healthy/moderate lifestyle
// AND skippable-empty orthopedics, so the live plan screen shows the "basic"
// banner and getActiveProfile() stays the single swap point for a future source.
const INITIAL_PROFILE: UserProfile = {
  id: "profile-active",
  name: "Active user",
  diseases: [],
  physicalProblems: [],
  lifestyle: DEFAULT_LIFESTYLE_PROFILE,
  ...DEFAULT_ONBOARDING_PROFILE,
  ...DEFAULT_ORTHOPEDIC_PROFILE,
};

/**
 * Returns the active profile: session-persisted when one was saved this
 * session, else the first-run fixture with null biometrics/experienceTier.
 * @returns UserProfile the onboarding screen seeds from.
 * @remarks Callers must not mutate the returned object.
 */
export function getActiveProfile(): UserProfile {
  return getStoredProfile() ?? INITIAL_PROFILE;
}

/**
 * Persists the completed onboarding profile in the entity slice store.
 * Call ONLY after a successful generation; in-memory, resets on reload.
 * @param profile The exact profile that was sent to the composer.
 */
export function saveActiveProfile(profile: UserProfile): void {
  persistProfile(profile);
}
