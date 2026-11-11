/* shared/ui/atoms/Button — dumb, token-styled action button.
   Boundary test: describable without plans/users/orders (ADR-0001 D5).
   Styling: tokens (src/shared/ui/tokens.css) only — every value is a
   var(--…) token reference; no hex, no rgb. Imports react only. */

import type { JSX, ReactNode } from "react";

export interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  type?: "button" | "submit";
}

const primaryStyle = {
  padding: "var(--sp-xs) var(--sp-sm)",
  background: "var(--accent-volt)",
  color: "var(--canvas)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-btn)",
  font: "var(--label-caps)",
  textTransform: "uppercase",
  cursor: "pointer",
} as const;

const secondaryStyle = {
  ...primaryStyle,
  background: "var(--surface-lifted)",
  color: "var(--text-high)",
} as const;

const VARIANT_STYLES = { primary: primaryStyle, secondary: secondaryStyle } as const;

export function Button({
  children,
  variant = "primary",
  onClick,
  type = "button",
}: ButtonProps): JSX.Element {
  return (
    <button type={type} style={VARIANT_STYLES[variant]} onClick={onClick}>
      {children}
    </button>
  );
}
