/* shared/ui atoms Button — node-safe SSR test (repo has no jsdom/testing-library;
   same react-dom/server + ?raw source-scan pattern as HistoryTable.test.tsx
   — plan assumption A5). */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { Button } from "../atoms/Button";
import buttonSource from "../atoms/Button.tsx?raw";

function render(element: ReactElement): string {
  // react-dom/server emits <!-- --> between adjacent text nodes — strip them
  // so text contents parse as plain text (same as HistoryTable.test.tsx).
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms Button — behavior", () => {
  it("renders the given label with type=button by default", () => {
    const html = render(<Button>Begin</Button>);
    expect(html).toContain(">Begin<");
    expect(html).toContain('type="button"');
  });

  it("primary variant (default) pins the accent-volt token", () => {
    expect(render(<Button>Go</Button>)).toContain("var(--accent-volt)");
  });

  it("secondary variant pins the surface-lifted token", () => {
    expect(
      render(<Button variant="secondary">Log</Button>),
    ).toContain("var(--surface-lifted)");
  });
});

describe("shared/ui atoms Button — source guards (ADR-0001 D5)", () => {
  it("no hardcoded colors in the atom source (tokens only)", () => {
    expect(buttonSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching in the atom source (AGENTS.md data rule)", () => {
    expect(buttonSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("atom imports only react (dumb, domain-free — add-pattern boundary)", () => {
    const importSources = buttonSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(importSources.length).toBeGreaterThan(0);
    for (const match of importSources) {
      expect(match).toBe('from "react"');
    }
  });
});
