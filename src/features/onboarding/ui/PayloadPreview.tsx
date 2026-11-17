/* features/onboarding/ui/PayloadPreview — generate request preview composition.
   Layer reason: feature-level view that renders entity payload using shared CodeBlock. */

import type { JSX } from "react";
import { CodeBlock } from "@shared/ui";
import type { GeneratePlanRequest } from "@entities/training-plan";

export interface PayloadPreviewProps {
  /** Request body shown and sent by the generate action. */
  request: GeneratePlanRequest;
}

/**
 * Renders a formatted JSON preview of the generate request payload.
 * @param props Request object to stringify.
 * @returns Read-only code preview region.
 * @remarks Do not use with huge payloads that need virtualization.
 */
export function PayloadPreview({ request }: PayloadPreviewProps): JSX.Element {
  return <CodeBlock label="Payload preview" code={JSON.stringify(request, null, 2)} />;
}
