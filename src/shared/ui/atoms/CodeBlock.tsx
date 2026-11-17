/* shared/ui/atoms/CodeBlock — dumb, token-styled preformatted block.
   Layer reason: domain-free primitive for rendering caller-provided code text. */

import type { JSX } from "react";

export interface CodeBlockProps {
  /** Accessible name of the region and visible caption text. */
  label: string;
  /** Preformatted text rendered verbatim; caller owns formatting. */
  code: string;
}

const containerStyle = {
  margin: 0,
  display: "grid",
  gap: "var(--sp-sm)",
  padding: "var(--sp-md)",
  background: "var(--surface)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-card)",
} as const;

const captionStyle = {
  margin: 0,
  font: "var(--label-caps)",
  color: "var(--text-muted)",
  textTransform: "uppercase",
} as const;

const preStyle = {
  margin: 0,
  overflow: "auto",
  whiteSpace: "pre",
  color: "var(--text-high)",
  fontFamily: "var(--font-metric)",
} as const;

/**
 * Renders a labeled, read-only preformatted code region.
 * @param props Region label and verbatim code text.
 * @returns Token-styled figure suitable for previews.
 * @remarks Do not use for editable text input; this is display-only.
 */
export function CodeBlock({ label, code }: CodeBlockProps): JSX.Element {
  return (
    <figure role="region" aria-label={label} style={containerStyle}>
      <figcaption style={captionStyle}>{label}</figcaption>
      <pre style={preStyle}>
        <code>{code}</code>
      </pre>
    </figure>
  );
}
