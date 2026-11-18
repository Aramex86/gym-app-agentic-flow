/* features/app-shell/ui/ComposerStatusIndicator — maps the composer status
   to the generic StatusIndicator atom's tone + label (plan A3 copy). This
   is the ONLY place the composer→tone/label mapping lives; the shared atom
   stays domain-free. */

import type { JSX } from "react";
import { StatusIndicator } from "@shared/ui";
import type { StatusTone } from "@shared/ui";
import type { ComposerStatus } from "@entities/composer";

/** Props: the current store status (the app-shell wires the hook). */
export interface ComposerStatusIndicatorProps {
  status: ComposerStatus;
}

/** Status → tone (A3 token semantics) + exact task copy (A7). */
const STATUS_COPY: Record<ComposerStatus, { tone: StatusTone; label: string }> = {
  online: { tone: "positive", label: "AI Composer online" },
  offline: { tone: "warning", label: "AI Composer offline" },
  unknown: { tone: "muted", label: "AI Composer checking…" },
};

export function ComposerStatusIndicator(
  props: ComposerStatusIndicatorProps,
): JSX.Element {
  const { tone, label } = STATUS_COPY[props.status];
  return <StatusIndicator tone={tone} label={label} />;
}
