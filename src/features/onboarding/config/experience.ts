/* features/onboarding/config — training-experience tier options.
   Layer reason: feature-local display labels for entity-level tier ids
   (mirrors config/goals.ts). Tier multipliers live ONLY in the entity. */

import type { ExperienceTierId } from "@entities/profile";

/** One experience-tier option rendered as a ChoiceChipGroup chip. */
export interface ExperienceTierOption {
  /** Entity tier id sent in the generate payload. */
  id: ExperienceTierId;
  /** Visible chip label. */
  label: string;
}

/** Ordered tier options aligned with EXPERIENCE_TIER_IDS (low -> high). */
export const EXPERIENCE_TIER_OPTIONS: readonly ExperienceTierOption[] = [
  { id: "novice", label: "Novice" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];
