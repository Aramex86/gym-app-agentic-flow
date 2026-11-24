/* features/onboarding/ui/OrthopedicLimitations — multi-select limitation chips
   + free-form caution composition.
   Layer reason: feature-level composition of shared ToggleChip + PromptInput
   over onboarding orthopedic config; no state, no data access. */

import type { JSX } from "react";
import { PromptInput, ToggleChip } from "@shared/ui";
import type { OrthopedicLimitationId } from "@entities/profile";
import {
  CAUTION_MAX_LENGTH,
  CAUTION_PLACEHOLDER,
  ORTHOPEDIC_LIMITATION_OPTIONS,
} from "../config/limitations";

export interface OrthopedicLimitationsProps {
  /** Selected ids in canonical order. */
  limitations: readonly OrthopedicLimitationId[];
  /** Raw caution text already capped by the owner. */
  caution: string;
  /** Called when a chip is toggled. */
  onToggle: (id: OrthopedicLimitationId) => void;
  /** Receives the raw next textarea value; the owner applies the cap. */
  onCautionChange: (next: string) => void;
  /** Freezes the textarea while a generate request is pending. */
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

const fieldsetStyle = {
  margin: 0,
  padding: 0,
  border: 0,
  display: "grid",
  gap: "var(--sp-sm)",
} as const;

const legendStyle = {
  padding: 0,
  font: "var(--label-caps)",
  color: "var(--text-muted)",
  textTransform: "uppercase",
} as const;

const chipsStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--sp-sm)",
} as const;

/**
 * Renders the optional orthopedic step: joint/movement chips + caution note.
 * @param props Current selection/text plus toggle/change callbacks.
 * @returns Orthopedic limitations section.
 * @remarks Do not use for required fields — both inputs are optional (empty
 *   values are valid and never block Generate).
 */
export function OrthopedicLimitations({
  limitations,
  caution,
  onToggle,
  onCautionChange,
  disabled,
}: OrthopedicLimitationsProps): JSX.Element {
  return (
    <section aria-label="Orthopedic limitations" style={sectionStyle}>
      <h3 style={headingStyle}>Orthopedic limitations</h3>
      <p style={hintStyle}>Optional — skip any field you don't need.</p>
      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>Joints / movements to protect</legend>
        <div style={chipsStyle}>
          {ORTHOPEDIC_LIMITATION_OPTIONS.map((option) => (
            <ToggleChip
              key={option.id}
              on={limitations.includes(option.id)}
              onToggle={() => onToggle(option.id)}
              label={option.label}
            />
          ))}
        </div>
      </fieldset>
      <PromptInput
        label="Caution note"
        rows={3}
        placeholder={CAUTION_PLACEHOLDER}
        maxLength={CAUTION_MAX_LENGTH}
        disabled={disabled}
        value={caution}
        onValueChange={onCautionChange}
      />
      {/* WHY: no role="status" — it would collide with Onboarding's pending-status query (plan A4 note). */}
      <p style={hintStyle}>
        {`${caution.length}/${CAUTION_MAX_LENGTH}`}
      </p>
    </section>
  );
}
