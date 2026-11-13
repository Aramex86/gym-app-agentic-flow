/* shared/ui/atoms/ToggleChip — dumb, token-styled toggle chip.
   Boundary test: describable without plans/users/orders (ADR-0001 D5).
   State is owned by the caller (`on` in, `onToggle` out) — the atom holds
   NO internal state and NO data logic. Styling: tokens
   (src/shared/ui/tokens.css) only; imports react only. */

import type { JSX } from "react";

export interface ToggleChipProps {
  /** Whether the toggle is currently on (drives styling + aria-pressed). */
  on: boolean;
  /** Invoked on click; the owner flips `on`. */
  onToggle: () => void;
  /** Visible and accessible text of the chip. */
  label: string;
}

const offStyle = {
  padding: "var(--sp-xs) var(--sp-sm)",
  background: "var(--surface-lifted)",
  color: "var(--text-high)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-pill)",
  font: "var(--label-caps)",
  textTransform: "uppercase",
  cursor: "pointer",
} as const;

const onStyle = {
  ...offStyle,
  background: "var(--accent-volt)",
  color: "var(--canvas)",
} as const;

export function ToggleChip({
  on,
  onToggle,
  label,
}: ToggleChipProps): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      style={on ? onStyle : offStyle}
    >
      {label}
    </button>
  );
}
