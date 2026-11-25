/* features/onboarding/config — body-metrics options.
   Layer reason: feature-local display labels/steps for entity-level biometric
   field ids, plus the human phrasing of entity validation issues. */

import type {
  BiometricFieldId,
  BiometricsIssue,
} from "@entities/profile";
import { BIOMETRIC_RANGES } from "@entities/profile";

/** One biometric input rendered as a NumberField. */
export interface BiometricFieldOption {
  /** Entity field id sent in the generate payload. */
  id: BiometricFieldId;
  /** Visible label shown above the input. */
  label: string;
  /** Native step hint (1 = whole numbers, 0.1 = decimals). */
  step: number;
  /** Example value shown as the empty-input placeholder. */
  placeholder: string;
}

/** Ordered body-metric options aligned with BIOMETRIC_FIELDS. */
export const BIOMETRIC_FIELD_OPTIONS: readonly BiometricFieldOption[] = [
  { id: "ageYears", label: "Age", step: 1, placeholder: "e.g. 30" },
  { id: "heightCm", label: "Height", step: 1, placeholder: "e.g. 178" },
  { id: "weightKg", label: "Weight", step: 0.1, placeholder: "e.g. 75" },
];

/** Look-up label for one entity field id (fallback never used — ids align). */
const LABELS: Record<BiometricFieldId, string> = {
  ageYears: "Age",
  heightCm: "Height",
  weightKg: "Weight",
};

/**
 * Human message for one entity validation issue (presentation only).
 * @param field Field whose option carries the label; same field as the issue's.
 * @param issue Entity issue code to phrase.
 * @returns One sentence like "Age must be between 13 and 100 years."
 * @remarks Do not call with a field id other than issue.field — callers look
 *   the issue up per field first; the entity guarantees at most one per field.
 */
export function biometricIssueMessage(field: BiometricFieldId, issue: BiometricsIssue): string {
  const label = LABELS[field];
  const range = BIOMETRIC_RANGES[issue.field];
  switch (issue.code) {
    case "required":
      return `${label} is required.`;
    case "not-a-number":
      return `${label} must be a number.`;
    case "not-an-integer":
      return `${label} must be a whole number.`;
    case "out-of-range":
      return `${label} must be between ${range.min} and ${range.max} ${range.unit}.`;
  }
}
