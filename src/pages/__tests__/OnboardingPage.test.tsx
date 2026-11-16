/* src/pages OnboardingPage — node-safe SSR smoke + source guard (tokens only
   in page source; no data access). */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { OnboardingPage } from "../OnboardingPage";
import onboardingPageSource from "../OnboardingPage.tsx?raw";

describe("pages OnboardingPage — placeholder surface (plan A5)", () => {
  it("renders the Onboarding heading and the 'later card' description", () => {
    const html = renderToString(<OnboardingPage />).replaceAll("<!-- -->", "");
    expect(html).toContain("<h2");
    expect(html).toContain("Onboarding");
    expect(html).toContain("arrives in a later card");
  });

  it("page source has no hardcoded colors (tokens come from the atom)", () => {
    expect(onboardingPageSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("page source does no data fetching (AGENTS.md data rule)", () => {
    expect(onboardingPageSource).not.toMatch(/fetch\s*\(|axios/i);
  });
});
