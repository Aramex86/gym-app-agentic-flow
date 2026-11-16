/* src/pages/LoggerPage — thin FSAA page: composes the shared EmptyState
   atom. Placeholder for the later Logger scenario card (plan A5); no logic,
   no data access, no styling beyond the atom. */

import { EmptyState } from "@shared/ui";

export function LoggerPage() {
  return (
    <EmptyState
      title="Logger"
      description="Workout logging arrives in a later card."
    />
  );
}
