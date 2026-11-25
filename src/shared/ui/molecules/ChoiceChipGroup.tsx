/* shared/ui/molecules/ChoiceChipGroup — dumb single-select chip selector.
   Layer reason: shared UI molecule (domain-free composition of the ToggleChip
   atom, tokens only, no data logic) reusable by any feature needing an
   exclusive single choice. State is owned by the caller; the group holds
   NO internal state and imports only react + ToggleChip. */

import type { JSX } from "react";
import { ToggleChip } from "@shared/ui/atoms/ToggleChip";

/** One selectable option in a ChoiceChipGroup. */
export interface ChoiceChipOption<Id extends string> {
  /** Stable value emitted on selection. */
  id: Id;
  /** Visible chip label. */
  label: string;
}

export interface ChoiceChipGroupProps<Id extends string> {
  /** Fieldset legend — also the group's accessible name. */
  legend: string;
  /** Ordered options to render. */
  options: readonly ChoiceChipOption<Id>[];
  /** Currently selected id; exactly one chip is pressed. `null` = nothing
   *  selected (required-but-unanswered group: zero chips pressed). */
  value: Id | null;
  /** Called only when a different chip is activated. */
  onChange: (id: Id) => void;
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
 * Renders a labeled group of chips with exactly one pressed option.
 * @param props Legend, ordered options, selected id and change callback.
 * @returns Single-select chip group.
 * @remarks Do not use for multi-select (zero or many on) — use ToggleChip
 *   directly as GoalSelect does. Selection is exactly one chip, except
 *   `value: null` (required-but-unanswered group): all chips render unpressed
 *   until the first pick; then the single-select invariant holds. Clicking the
 *   pressed chip never clears a non-null selection.
 */
export function ChoiceChipGroup<Id extends string>({
  legend,
  options,
  value,
  onChange,
}: ChoiceChipGroupProps<Id>): JSX.Element {
  return (
    <fieldset style={fieldsetStyle}>
      <legend style={legendStyle}>{legend}</legend>
      <div style={chipsStyle}>
        {options.map((option) => (
          <ToggleChip
            key={option.id}
            on={option.id === value}
            // WHY: activating the pressed chip must not clear the selection —
            // clearing (to null) is an owner-level reset via props, not a
            // group-level click effect.
            onToggle={() => {
              if (option.id !== value) {
                onChange(option.id);
              }
            }}
            label={option.label}
          />
        ))}
      </div>
    </fieldset>
  );
}
