/* shared/ui/atoms/AlertBanner — dumb, token-styled alert message.
   Layer reason: domain-free primitive for accessible error/warning notices. */

import type { JSX } from "react";

export interface AlertBannerProps {
  /** Message rendered verbatim inside the alert region. */
  message: string;
}

const wrapperStyle = {
  padding: "var(--sp-sm) var(--sp-md)",
  background: "var(--surface-lifted)",
  border: "1px solid var(--accent-amber)",
  borderRadius: "var(--r-card)",
  color: "var(--text-high)",
} as const;

const textStyle = {
  margin: 0,
} as const;

/**
 * Renders an accessible alert banner.
 * @param props Message content to announce to assistive tech.
 * @returns A role="alert" container with token-only styling.
 * @remarks Do not use for non-critical inline hints; reserve for alert semantics.
 */
export function AlertBanner({ message }: AlertBannerProps): JSX.Element {
  return (
    <div role="alert" style={wrapperStyle}>
      <p style={textStyle}>{message}</p>
    </div>
  );
}
