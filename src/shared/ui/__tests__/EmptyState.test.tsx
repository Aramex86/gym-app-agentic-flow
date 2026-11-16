/* shared/ui atoms EmptyState — node-safe SSR tests with ?raw source guards
   (same pattern as Button.test.tsx). */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { EmptyState } from "../atoms/EmptyState";
import emptyStateSource from "../atoms/EmptyState.tsx?raw";

function render(element: ReactElement): string {
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms EmptyState — render", () => {
  it("renders title as heading and description as paragraph", () => {
    const html = render(
      <EmptyState title="Logger" description="Arrives in a later card." />,
    );
    expect(html).toContain("<h2");
    expect(html).toContain("Logger");
    expect(html).toContain("Arrives in a later card.");
  });

  it("pins the token styles for heading, body and spacing", () => {
    const html = render(
      <EmptyState title="T" description="D" />,
    );
    expect(html).toContain("var(--text-high)");
    expect(html).toContain("var(--text-muted)");
    expect(html).toContain("var(--font-heading)");
  });
});

describe("shared/ui atoms EmptyState — source guards (ADR-0001 D5 / add-pattern)", () => {
  it("no hardcoded colors in the atom source (tokens only)", () => {
    expect(emptyStateSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching in the atom source (AGENTS.md data rule)", () => {
    expect(emptyStateSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("atom imports only react (dumb, domain-free — add-pattern boundary)", () => {
    const importSources = emptyStateSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(importSources.length).toBeGreaterThan(0);
    for (const match of importSources) {
      expect(match).toBe('from "react"');
    }
  });
});
