/* features/onboarding/ui/ExperienceTierSelect — training-experience composition.
   Layer reason: feature-level composition of the shared ChoiceChipGroup
   molecule (nullable value) over onboarding tier config; no state, no data
   access. Pending freeze is handled by the owner ignoring changes. */

import type { JSX } from "react";
import { ChoiceChipGroup } from "@shared/ui";
import type { ExperienceTierId } from "@entities/profile";
import { EXPERIENCE_TIER_OPTIONS } from "../config/experience";

export interface ExperienceTierSelectProps {
  /** Pressed tier, or null while the required pick is unanswered. */
  value: ExperienceTierId | null;
  /** Receives the newly selected entity tier id; null is not sent back. */
  onChange: (tier: ExperienceTierId) => void;
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
 * Renders the required novice/intermediate/advanced chip group.
 * @param props Nullable selected tier and change callback.
 * @returns Training experience section.
 * @remarks Do not use for skippable fields — this pick is required and gates
 *   the generate CTA; tier multipliers live in the profile entity only.
 */
export function ExperienceTierSelect(props: ExperienceTierSelectProps): JSX.Element {
  return (
    <section aria-label="Training experience" style={sectionStyle}>
      <h3 style={headingStyle}>Training experience</h3>
      <p style={hintStyle}>Required — sets your starting training volume.</p>
      <ChoiceChipGroup
        legend="Experience tier"
        options={EXPERIENCE_TIER_OPTIONS}
        value={props.value}
        onChange={props.onChange}
      />
    </section>
  );
}
