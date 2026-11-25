/* entities/profile — state / business logic. Pure selectors, validation and
   the in-memory profile store: no React, no I/O, no browser storage
   (ADR-0005 — persisting resets on every reload). */

import type {
  Biometrics,
  BiometricsDraft,
  BiometricsIssue,
  BiometricFieldId,
  ExperienceTierId,
  UserProfile,
} from "./types";
import {
  BIOMETRIC_FIELDS,
  BIOMETRIC_RANGES,
  EMPTY_BIOMETRICS_DRAFT,
  EXPERIENCE_VOLUME_MULTIPLIERS,
} from "./types";

/** True when the user declared any disease or physical problem — the
    condition that upgrades the plan disclaimer to the doctor-warning
    variant (ADR-0001 D4). */
export function hasHealthConditions(profile: UserProfile): boolean {
  return profile.diseases.length > 0 || profile.physicalProblems.length > 0;
}

/**
 * Validates a raw biometrics draft against the canonical ranges.
 * @param draft User text per field, before any normalization.
 * @returns At most one issue per field, in BIOMETRIC_FIELDS order
 *   (deterministic for tests); empty array when the draft is complete.
 * @remarks Codes checked in order: required, not-a-number, not-an-integer
 *   (whole-year/cm fields only), out-of-range. Native `type="number"` min/max
 *   are UX hints only — this validation is the gate.
 */
export function validateBiometrics(draft: BiometricsDraft): BiometricsIssue[] {
  const issues: BiometricsIssue[] = [];
  for (const field of BIOMETRIC_FIELDS) {
    const raw = draft[field].trim();
    if (raw === "") {
      issues.push({ field, code: "required" });
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      issues.push({ field, code: "not-a-number" });
      continue;
    }
    const range = BIOMETRIC_RANGES[field];
    if (range.integer && !Number.isInteger(value)) {
      issues.push({ field, code: "not-an-integer" });
      continue;
    }
    if (value < range.min || value > range.max) {
      issues.push({ field, code: "out-of-range" });
    }
  }
  return issues;
}

/**
 * Cheap "is the draft acceptable" check.
 * @param draft User text per field.
 * @returns True when validateBiometrics(draft) has no issues.
 */
export function isBiometricsComplete(draft: BiometricsDraft): boolean {
  return validateBiometrics(draft).length === 0;
}

/**
 * Normalizes a validated draft into the wire biometrics object.
 * @param draft User text per field.
 * @returns Numeric biometrics, or null when any field is invalid — null means
 *   "required field incomplete" and must block the generate CTA.
 */
export function toBiometrics(draft: BiometricsDraft): Biometrics | null {
  if (!isBiometricsComplete(draft)) {
    return null;
  }
  return {
    ageYears: Number(draft.ageYears.trim()),
    heightCm: Number(draft.heightCm.trim()),
    weightKg: Number(draft.weightKg.trim()),
  };
}

/**
 * Seeds a form draft from stored biometrics.
 * @param biometrics Stored biometrics, or null (first run).
 * @returns Fresh string draft; null maps to an empty draft.
 * @remarks Never returns the shared EMPTY_BIOMETRICS_DRAFT reference — callers
 *   may mutate the draft through their state setter.
 */
export function toBiometricsDraft(biometrics: Biometrics | null): BiometricsDraft {
  if (biometrics === null) {
    return { ...EMPTY_BIOMETRICS_DRAFT };
  }
  return {
    ageYears: String(biometrics.ageYears),
    heightCm: String(biometrics.heightCm),
    weightKg: String(biometrics.weightKg),
  };
}

/**
 * Canonical experience-tier volume multiplier (the composer's contract).
 * @param tier Entity tier id.
 * @returns The tier's multiplier: novice 0.8, intermediate 1, advanced 1.2.
 */
export function getExperienceVolumeMultiplier(tier: ExperienceTierId): number {
  return EXPERIENCE_VOLUME_MULTIPLIERS[tier];
}

/* --- In-memory profile store ------------------------------------------- */

// WHY: the store is module-level state in the entity slice (not shared/config)
// because UserProfile lives here and shared may not import entities. In-memory
// only (ADR-0005): resets on every page reload.
let storedProfile: UserProfile | null = null;

/**
 * Reads the persisted profile, if one was saved this session.
 * @returns The stored profile or null (first run); internal to the entity.
 * @remarks Do not export from the barrel — persistence routing goes through
 *   api.ts getActiveProfile/saveActiveProfile only.
 */
export function getStoredProfile(): UserProfile | null {
  return storedProfile;
}

/**
 * Writes the profile into the in-memory store. Internal to the entity.
 * @param profile Complete profile (usually the exact request that was sent).
 */
export function persistProfile(profile: UserProfile): void {
  storedProfile = profile;
}

/**
 * Test seam: clears the store so the next getActiveProfile() returns the
 * first-run fixture (null biometrics/tier).
 * @remarks Every suite that generates or reads the profile must call this in
 *   afterEach — storedProfile is module-global.
 */
export function resetActiveProfile(): void {
  storedProfile = null;
}
