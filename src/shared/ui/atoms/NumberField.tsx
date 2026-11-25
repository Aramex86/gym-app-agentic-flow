/* shared/ui/atoms/NumberField — dumb, token-styled controlled numeric input.
   Boundary test: describable without ages/weights/plans (ADR-0001 D5).
   Owns NO validation, NO state, NO data access — raw text in, raw text out
   (the entity owns the rules; the atom only displays a phrased hint line).
   Styling: tokens (src/shared/ui/tokens.css) only; imports react only. */

import { useId } from "react";
import type { JSX } from "react";

export interface NumberFieldProps {
  /** Visible and accessible label text, wired to the input via htmlFor/id. */
  label: string;
  /** Raw controlled text (form draft); keep it in owner state. */
  value: string;
  /** Invoked on every change (including clearing) with the raw input value. */
  onValueChange: (value: string) => void;
  /** Displayed unit suffix next to the input, e.g. "cm". */
  unit?: string;
  /** Native min hint (the owner's validation is the real gate). */
  min?: number;
  /** Native max hint (the owner's validation is the real gate). */
  max?: number;
  /** Native step hint, e.g. 1 for whole numbers, 0.1 for decimals. */
  step?: number;
  /** Optional placeholder hint. */
  placeholder?: string;
  /** Disables the input (pending freeze); no color change, cursor only. */
  disabled?: boolean;
  /** Marks the field as required for assistive tech (aria-required). */
  required?: boolean;
  /** aria-invalid + amber edge highlighting; owner decides when. */
  invalid?: boolean;
  /** Helper or error line below the input, phrased by the owner. */
  hint?: string;
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

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "var(--sp-sm)",
} as const;

// WHY: longhand border properties only — the invalid variant overrides
// borderColor, and React warns when shorthand/non-shorthand styles are mixed
// across rerenders.
const inputStyle = {
  padding: "var(--sp-sm) var(--sp-md)",
  background: "var(--surface-lifted)",
  color: "var(--text-high)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--edge)",
  borderRadius: "var(--r-btn)",
  fontFamily: "var(--font-body)",
  minWidth: 0,
  flex: 1,
} as const;

const invalidInputStyle = {
  ...inputStyle,
  borderColor: "var(--accent-amber)",
} as const;

const unitStyle = {
  color: "var(--text-muted)",
} as const;

const hintStyle = {
  margin: 0,
  color: "var(--text-muted)",
} as const;

const invalidHintStyle = {
  ...hintStyle,
  color: "var(--accent-amber)",
} as const;

/**
 * Renders a labeled controlled numeric input with an optional unit and hint.
 * @param props Label, controlled draft text, change callback and display hints.
 * @returns One numeric field.
 * @remarks Do not use when the value is not numeric-shaped; validation and
 *   error phrasing belong to the owner (entity rules, feature config).
 */
export function NumberField(props: NumberFieldProps): JSX.Element {
  const {
    label,
    value,
    onValueChange,
    unit,
    min,
    max,
    step,
    placeholder,
    disabled,
    required,
    invalid,
    hint,
  } = props;
  const id = useId();
  const hintId = hint === undefined ? undefined : `${id}-hint`;

  return (
    <div style={wrapperStyle}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <span style={rowStyle}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          autoComplete="off"
          style={invalid ? invalidInputStyle : inputStyle}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          {...(min === undefined ? {} : { min })}
          {...(max === undefined ? {} : { max })}
          {...(step === undefined ? {} : { step })}
          {...(placeholder === undefined ? {} : { placeholder })}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          aria-describedby={hintId}
        />
        {unit === undefined ? null : <span style={unitStyle}>{unit}</span>}
      </span>
      {hint === undefined ? null : (
        <p id={hintId} style={invalid ? invalidHintStyle : hintStyle}>
          {hint}
        </p>
      )}
    </div>
  );
}
