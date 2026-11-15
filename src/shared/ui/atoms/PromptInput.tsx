/* shared/ui/atoms/PromptInput — dumb, token-styled controlled textarea for
   free-form instructions. Layer: shared/ui (ADR-0001 D5): describable
   without plans/profiles/requests — value in, onValueChange out. Owns NO
   state, NO effects, NO data access; the owner keeps the pending/frozen
   logic and just passes `disabled`. Styling: tokens (tokens.css) only;
   imports react only. */

import { useId } from "react";
import type { JSX } from "react";

export interface PromptInputProps {
  /** Visible + accessible label, wired via htmlFor/id. */
  label: string;
  /** Controlled value; the owner keeps the state. */
  value: string;
  /** Called on every change with the raw textarea value. */
  onValueChange: (value: string) => void;
  /** Optional placeholder hint. */
  placeholder?: string;
  /** Native disabled; used to freeze input while a request is pending. */
  disabled?: boolean;
  /** Visible text rows; default 3. */
  rows?: number;
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

const textareaStyle = {
  padding: "var(--sp-sm) var(--sp-md)",
  background: "var(--surface-lifted)",
  color: "var(--text-high)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-btn)",
  fontFamily: "var(--font-body)",
  resize: "vertical",
} as const;

export function PromptInput({
  label,
  value,
  onValueChange,
  placeholder,
  disabled,
  rows = 3,
}: PromptInputProps): JSX.Element {
  const id = useId();

  return (
    <div style={wrapperStyle}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        style={textareaStyle}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </div>
  );
}
