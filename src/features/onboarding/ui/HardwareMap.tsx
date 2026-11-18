/* features/onboarding/ui/HardwareMap — onboarding hardware map composition.
   Layer reason: feature-level composition of shared InfoCard over hardware config data. */

import type { JSX } from "react";
import { InfoCard } from "@shared/ui";
import { HARDWARE_MAP } from "../config/hardware";

const sectionStyle = {
  display: "grid",
  gap: "var(--sp-sm)",
} as const;

const cardsStyle = {
  display: "grid",
  gap: "var(--sp-sm)",
} as const;

const headingStyle = {
  margin: 0,
  color: "var(--text-high)",
} as const;

/**
 * Renders the read-only hardware/device map cards.
 * @returns Hardware map section.
 * @remarks Do not use for editable hardware selection; this card is display-only.
 */
export function HardwareMap(): JSX.Element {
  return (
    <section aria-label="Hardware map" style={sectionStyle}>
      <h3 style={headingStyle}>Hardware map</h3>
      <div style={cardsStyle}>
        {HARDWARE_MAP.map((source) => (
          <InfoCard
            key={source.id}
            title={source.device}
            description={source.method}
            tags={source.tracks}
          />
        ))}
      </div>
    </section>
  );
}
