/* shared/ui atoms StatCard — node-safe SSR test (repo has no jsdom/testing-
   library; same react-dom/server + ?raw source-scan pattern as
   Button.test.tsx). Covers plan Step 7 required cases: text render, both
   tones pinning the muted/accent tokens, typography roles, and the
   ADR-0001 D5 source guards (tokens only, no data fetching, react-only
   imports). */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { StatCard } from "../atoms/StatCard";
import statCardSource from "../atoms/StatCard.tsx?raw";

function render(element: ReactElement): string {
  // react-dom/server emits <!-- --> between adjacent text nodes — strip them
  // so text contents parse as plain text (same as Button.test.tsx).
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms StatCard — behavior", () => {
  it("renders label and value", () => {
    const html = render(
      <StatCard label="Weekly volume" value="12,480 kg" tone="muted" />,
    );
    expect(html).toContain(">Weekly volume<");
    expect(html).toContain(">12,480 kg<");
  });

  it('tone="muted" pins muted value + surface chrome', () => {
    const html = render(<StatCard label="Active sets" value="18" tone="muted" />);
    expect(html).toMatch(/color:\s*var\(--text-muted\)/);
    expect(html).toContain("var(--surface)");
    expect(html).toContain("var(--edge)");
    expect(html).toContain("var(--r-card)");
    expect(html).toContain("var(--sp-md)");
    expect(html).not.toContain("var(--accent-volt)");
  });

  it('tone="accent" pins the accent value', () => {
    const html = render(<StatCard label="Active sets" value="18" tone="accent" />);
    expect(html).toMatch(/color:\s*var\(--accent-volt\)/);
  });

  it("both tones pin the label-caps + metric typography roles", () => {
    for (const tone of ["muted", "accent"] as const) {
      const html = render(<StatCard label="Active sets" value="18" tone={tone} />);
      expect(html).toContain("var(--label-caps)");
      expect(html).toContain("var(--font-metric)");
      expect(html).toContain("var(--metric-lg-size)");
      expect(html).toContain("var(--metric-lg-weight)");
      expect(html).toContain("uppercase");
    }
  });
});

describe("shared/ui atoms StatCard — source guards (ADR-0001 D5)", () => {
  it("no hardcoded colors (tokens only)", () => {
    expect(statCardSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching (AGENTS.md data rule)", () => {
    expect(statCardSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("imports only react (dumb, domain-free)", () => {
    const imports = statCardSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const match of imports) expect(match).toBe('from "react"');
  });
});
