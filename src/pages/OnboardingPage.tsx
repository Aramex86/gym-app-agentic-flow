/* src/pages/OnboardingPage — thin FSAA page wiring for onboarding scenario.
   Page owns routing only; onboarding behavior remains in @features/onboarding. */

import { useNavigate } from "react-router-dom";
import { Onboarding } from "@features/onboarding";
import { navSurfaceById } from "@shared/config/nav";

/**
 * Thin onboarding page that wires feature success to My Plan navigation.
 * @returns Onboarding feature surface.
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const myPlanPath = navSurfaceById("my-plan")?.path ?? "/progress";
  return <Onboarding onGenerated={() => navigate(myPlanPath)} />;
}
