/* src/pages/OnboardingPage — thin FSAA page: composes the shared EmptyState
   atom. Placeholder for the later Onboarding scenario card (plan A5); no
   logic, no data access, no styling beyond the atom. */

import { EmptyState } from "@shared/ui";

export function OnboardingPage() {
  return (
    <EmptyState
      title="Onboarding"
      description="Guided setup arrives in a later card."
    />
  );
}
