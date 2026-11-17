/* shared/ui/atoms/InfoCard — dumb, token-styled summary card.
   Layer reason: domain-free primitive for title/description/tag presentation. */

import type { JSX } from "react";

export interface InfoCardProps {
  /** Title shown as the card heading. */
  title: string;
  /** Supporting description text shown under the heading. */
  description: string;
  /** Short tag labels rendered as pills; may be empty. */
  tags: readonly string[];
}

const cardStyle = {
  display: "grid",
  gap: "var(--sp-sm)",
  padding: "var(--sp-md)",
  background: "var(--surface)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-card)",
} as const;

const titleStyle = {
  margin: 0,
  color: "var(--text-high)",
} as const;

const descriptionStyle = {
  margin: 0,
  color: "var(--text-muted)",
} as const;

const tagsStyle = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--sp-xs)",
} as const;

const tagStyle = {
  padding: "var(--sp-xs) var(--sp-sm)",
  background: "var(--surface-lifted)",
  borderRadius: "var(--r-pill)",
  color: "var(--accent-teal)",
  font: "var(--label-caps)",
  textTransform: "uppercase",
} as const;

/**
 * Renders an informational card with optional tags.
 * @param props Card heading, description, and tag labels.
 * @returns Read-only, token-styled card markup.
 * @remarks Do not use for interactive controls; this component is static content.
 */
export function InfoCard({ title, description, tags }: InfoCardProps): JSX.Element {
  return (
    <article style={cardStyle}>
      <h3 style={titleStyle}>{title}</h3>
      <p style={descriptionStyle}>{description}</p>
      {tags.length > 0 ? (
        <ul style={tagsStyle}>
          {tags.map((tag) => (
            <li key={tag} style={tagStyle}>
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
