/* features/onboarding/config — orthopedic limitation options.
   Layer reason: feature-local display labels + textarea caps for entity-level
   orthopedic limitation ids (plain data only, imported by feature UI). */

import type { OrthopedicLimitationId } from "@entities/profile";

/** One orthopedic limitation option rendered as a multi-select chip. */
export interface LimitationOption {
  /** Stable wire id sent in the generate payload. */
  id: OrthopedicLimitationId;
  /** Human-readable label shown on the chip. */
  label: string;
}

/** Ordered labels aligned with ORTHOPEDIC_LIMITATION_IDS. */
export const ORTHOPEDIC_LIMITATION_OPTIONS: readonly LimitationOption[] = [
  { id: "knee", label: "Knee" },
  { id: "lower-back", label: "Lower back" },
  { id: "shoulder", label: "Shoulder" },
  { id: "wrist", label: "Wrist" },
  { id: "custom", label: "Custom" },
];

/** Hard cap for the free-form caution textarea (characters). */
export const CAUTION_MAX_LENGTH = 280;

/** Example hint; never a value sent to the composer. */
export const CAUTION_PLACEHOLDER =
  "e.g. Avoid deep knee flexion; no overhead pressing";
