/* shared/ui/atoms/SearchInput — dumb, token-styled controlled search field.
   Boundary test: describable without plans/exercises/history (ADR-0001 D5).
   Owns NO query state, NO filtering, NO data access — value in,
   onValueChange out (same contract as ToggleChip's on/onToggle). Styling:
   tokens (src/shared/ui/tokens.css) only; imports react only. */

import { useId } from "react";
import type { JSX } from "react";

export interface SearchInputProps {
  /** Visible and accessible label text, wired to the input via htmlFor/id. */
  label: string;
  /** Controlled value; keep it in owner state. */
  value: string;
  /** Invoked on every change (including clearing) with the raw input value. */
  onValueChange: (value: string) => void;
  /** Optional placeholder hint. */
  placeholder?: string;
}

const wrapperStyle = {
  display: "grid",
  gap: "var(--sp-xs)",
} as const;

const labelStyle = {
  color: "var(--text-muted)",
  font: "var(--label-caps)",
  textTransform: "uppercase",
} as const;

const inputStyle = {
  padding: "var(--sp-sm) var(--sp-md)",
  background: "var(--surface-lifted)",
  color: "var(--text-high)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-btn)",
  fontFamily: "var(--font-body)",
} as const;

export function SearchInput({
  label,
  value,
  onValueChange,
  placeholder,
}: SearchInputProps): JSX.Element {
  const id = useId();

  return (
    <div style={wrapperStyle}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        style={inputStyle}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </div>
  );
}
