/* features/onboarding/ui/BiometricsForm — body-metrics composition.
   Layer reason: feature-level composition of the shared NumberField atom over
   onboarding biometrics config; no state, no validation, no data access —
   draft and issues come in from the owner (Onboarding), raw edits go back. */

import type { JSX } from "react";
import { NumberField } from "@shared/ui";
import type {
  BiometricsDraft,
  BiometricsIssue,
  BiometricFieldId,
} from "@entities/profile";
import { BIOMETRIC_RANGES } from "@entities/profile";
import { BIOMETRIC_FIELD_OPTIONS, biometricIssueMessage } from "../config/biometrics";

export interface BiometricsFormProps {
  /** Raw draft text per field, owned by the caller. */
  value: BiometricsDraft;
  /** Entity issues for the current draft (at most one per field). */
  issues: readonly BiometricsIssue[];
  /** Receives the field id and the raw new text (no normalization here). */
  onChange: (field: BiometricFieldId, raw: string) => void;
  /** Disables all inputs (pending freeze). */
  disabled?: boolean;
}

const sectionStyle = {
  display: "grid",
  gap: "var(--sp-sm)",
} as const;

const headingStyle = {
  margin: 0,
  color: "var(--text-high)",
} as const;

const hintStyle = {
  margin: 0,
  color: "var(--text-muted)",
} as const;

/**
 * Renders the required age/height/weight inputs for onboarding.
 * @param props Draft, entity issues, change callback and disabled flag.
 * @returns Body metrics section.
 * @remarks Do not use for optional inputs — every field here is required and
 *   gates the generate CTA; ranges and codes come from the profile entity.
 */
export function BiometricsForm(props: BiometricsFormProps): JSX.Element {
  return (
    <section aria-label="Body metrics" style={sectionStyle}>
      <h3 style={headingStyle}>Body metrics</h3>
      <p style={hintStyle}>Required to build your plan.</p>
      {BIOMETRIC_FIELD_OPTIONS.map((option) => {
        // WHY: at most one issue per field is guaranteed by validateBiometrics's
        // canonical-order loop, so a single find is exact.
        const issue = props.issues.find((entry) => entry.field === option.id);
        // WHY: required is already phrased by the neutral hint line; only the
        // actionable wrong-input codes get the amber (invalid) treatment.
        return (
          <NumberField
            key={option.id}
            label={option.label}
            value={props.value[option.id]}
            onValueChange={(raw) => props.onChange(option.id, raw)}
            unit={BIOMETRIC_RANGES[option.id].unit}
            min={BIOMETRIC_RANGES[option.id].min}
            max={BIOMETRIC_RANGES[option.id].max}
            step={option.step}
            placeholder={option.placeholder}
            invalid={issue !== undefined && issue.code !== "required"}
            hint={issue === undefined ? undefined : biometricIssueMessage(option.id, issue)}
            disabled={props.disabled}
            required={true}
          />
        );
      })}
    </section>
  );
}
