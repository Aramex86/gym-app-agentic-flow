/* features/onboarding/ui/GoalSelect — goal chip multiselect composition.
   Layer reason: feature-level composition of shared ToggleChip over onboarding goal config. */

import type { JSX } from "react";
import { ToggleChip } from "@shared/ui";
import type { TrainingGoalId } from "@entities/training-plan";
import { GOAL_OPTIONS } from "../config/goals";

export interface GoalSelectProps {
  /** Selected goal ids. */
  selected: readonly TrainingGoalId[];
  /** Called when a chip is toggled. */
  onToggle: (id: TrainingGoalId) => void;
}

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
 * Renders onboarding goal chips in a labeled fieldset.
 * @param props Selected goal ids and toggle callback.
 * @returns Goal selection UI.
 * @remarks Do not use for single-choice selection; this component is multiselect.
 */
export function GoalSelect({ selected, onToggle }: GoalSelectProps): JSX.Element {
  return (
    <fieldset style={fieldsetStyle}>
      <legend style={legendStyle}>Training goals</legend>
      <div style={chipsStyle}>
        {GOAL_OPTIONS.map((option) => (
          <ToggleChip
            key={option.id}
            on={selected.includes(option.id)}
            onToggle={() => onToggle(option.id)}
            label={option.label}
          />
        ))}
      </div>
    </fieldset>
  );
}
