/* features/onboarding/ui/LifestyleRecovery — lifestyle & recovery composition.
   Layer reason: feature-level composition of the shared ChoiceChipGroup
   molecule over onboarding lifestyle config; no state, no data access. */

import type { JSX } from "react";
import { ChoiceChipGroup } from "@shared/ui";
import type { LifestyleProfile } from "@entities/profile";
import {
  DAILY_ACTIVITY_OPTIONS,
  SLEEP_DURATION_OPTIONS,
  STRESS_LEVEL_OPTIONS,
} from "../config/lifestyle";

export interface LifestyleRecoveryProps {
  /** Current lifestyle values (seeded from the profile's defaults). */
  value: LifestyleProfile;
  /** Receives a complete next LifestyleProfile. */
  onChange: (next: LifestyleProfile) => void;
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
 * Renders the sleep / activity / stress chip groups for onboarding.
 * @param props Current lifestyle values and change callback.
 * @returns Lifestyle & recovery section.
 * @remarks Do not use for required fields — every group opens on a moderate/
 *   healthy default and never blocks proceeding.
 */
export function LifestyleRecovery({ value, onChange }: LifestyleRecoveryProps): JSX.Element {
  return (
    <section aria-label="Lifestyle & recovery" style={sectionStyle}>
      <h3 style={headingStyle}>Lifestyle & recovery</h3>
      <p style={hintStyle}>Skip any field — moderate defaults are already applied.</p>
      <ChoiceChipGroup
        legend="Sleep duration"
        options={SLEEP_DURATION_OPTIONS}
        value={value.sleepDuration}
        onChange={(id) => onChange({ ...value, sleepDuration: id })}
      />
      <ChoiceChipGroup
        legend="Daily activity"
        options={DAILY_ACTIVITY_OPTIONS}
        value={value.dailyActivity}
        onChange={(id) => onChange({ ...value, dailyActivity: id })}
      />
      <ChoiceChipGroup
        legend="Stress level"
        options={STRESS_LEVEL_OPTIONS}
        value={value.stressLevel}
        onChange={(id) => onChange({ ...value, stressLevel: id })}
      />
    </section>
  );
}
