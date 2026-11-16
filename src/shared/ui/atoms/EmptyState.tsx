/* shared/ui/atoms/EmptyState — generic title/description placeholder block.
   Boundary test: describable without any domain — pages pass the copy
   ("arrives in a later card" is page-level text, NOT atom text).
   Styling: tokens (src/shared/ui/tokens.css) only; imports react types only. */

import type { JSX } from "react";

/** Props of the placeholder block atom. */
export interface EmptyStateProps {
  /** Block heading. */
  title: string;
  /** One-line supporting copy. */
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps): JSX.Element {
  return (
    <section
      style={{
        padding: "var(--sp-lg)",
        display: "grid",
        gap: "var(--sp-sm)",
      }}
    >
      <h2 style={{ margin: 0, color: "var(--text-high)", font: "var(--font-heading)" }}>
        {title}
      </h2>
      <p style={{ margin: 0, color: "var(--text-muted)" }}>{description}</p>
    </section>
  );
}
