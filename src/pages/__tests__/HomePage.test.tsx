/* pages HomePage — node-safe SSR test (repo has no jsdom/testing-library,
   same react-dom/server pattern as shared/ui AppShell.test.tsx).
   Row count is DERIVED from SAMPLE_PLAN, not hardcoded — the test
   survives sample-data edits (only the exact 40 is an acceptance pin
   from plan-schema §6, asserted alongside the derived value).
   Search interaction is covered by the feature suite in
   src/features/training-history-search/__tests__/. */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { HomePage } from "../HomePage";
import homePageSource from "../HomePage.tsx?raw";
import { SAMPLE_PLAN } from "@shared/config/plan.sample";

function render(): string {
  // react-dom/server emits <!-- --> between adjacent text nodes — strip them
  // so cell contents parse as plain text.
  return renderToString(<HomePage />).replaceAll("<!-- -->", "");
}

describe("pages HomePage", () => {
  it("renders without throwing", () => {
    expect(() => render()).not.toThrow();
  });

  it("renders a Home heading", () => {
    expect(render()).toContain(">Home<");
  });

  it("renders the wired search field above the table (label + searchbox pair)", () => {
    const html = render();
    expect(html).toContain('type="search"');
    expect(html).toContain(">Search exercises</label>");

    const forAttribute = html.match(/<label[^>]*\bfor="([^"]+)"/)?.[1];
    const idAttribute = html.match(/<input[^>]*\bid="([^"]+)"/)?.[1];
    expect(forAttribute).toBeTruthy();
    expect(idAttribute).toBeTruthy();
    expect(forAttribute).toBe(idAttribute);
    // The feature's configured hint reaches the page unchanged.
    expect(html).toContain('placeholder="Search by exercise name"');
  });

  it("renders the history table with SAMPLE_PLAN data", () => {
    const html = render();
    const rowCount = html.match(/data-testid="history-row"/g)?.length ?? 0;

    // Derived from the sample module (survives sample edits):
    const derived = SAMPLE_PLAN.weeks
      .flatMap((w) => w.days)
      .flatMap((d) => d.exercises).length;
    expect(rowCount).toBe(derived);

    // Acceptance pin from the plan: 4 weeks x 2 days x 5 exercises.
    expect(rowCount).toBe(40);

    // Real data, not rows of dashes: a known sample exercise name appears.
    expect(html).toContain("Back Squat");
  });

  it("renders the default Training history caption and all six headers", () => {
    const html = render();
    expect(html).toContain("Training history");
    for (const header of ["Week", "Split", "Exercise", "Sets × Reps", "RPE", "Rest"]) {
      expect(html).toContain(`>${header}<`);
    }
  });

  it("styles via tokens only — no hardcoded colors in page source", () => {
    expect(homePageSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });
});
