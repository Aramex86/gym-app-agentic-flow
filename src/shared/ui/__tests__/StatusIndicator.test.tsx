/* shared/ui atoms StatusIndicator — node-safe SSR tests with ?raw source
   guards (tokens only, domain-free, react-imports-only — same pattern as
   Button.test.tsx). */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { StatusIndicator } from "../atoms/StatusIndicator";
import statusIndicatorSource from "../atoms/StatusIndicator.tsx?raw";

function render(element: ReactElement): string {
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms StatusIndicator — render", () => {
  it("renders the label inside a polite role=status region", () => {
    const html = render(<StatusIndicator tone="positive" label="AI Composer online" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("AI Composer online");
  });

  it("positive tone pins the accent-teal token", () => {
    expect(render(<StatusIndicator tone="positive" label="on" />)).toContain(
      "var(--accent-teal)",
    );
  });

  it("warning tone pins the accent-amber token", () => {
    expect(render(<StatusIndicator tone="warning" label="off" />)).toContain(
      "var(--accent-amber)",
    );
  });

  it("muted tone pins the text-muted token", () => {
    expect(render(<StatusIndicator tone="muted" label="…" />)).toContain(
      "var(--text-muted)",
    );
  });

  it("dot is 6px with a 6px pair gap (stitch-appshell-ref §3)", () => {
    const html = render(<StatusIndicator tone="positive" label="on" />);
    expect(html).toContain("width:6px");
    expect(html).toContain("height:6px");
    expect(html).toContain("gap:6px");
  });

  it("positive tone adds the teal glow token", () => {
    expect(render(<StatusIndicator tone="positive" label="on" />)).toContain(
      "box-shadow:var(--accent-glow-teal)",
    );
  });

  it("warning tone adds the amber glow token", () => {
    expect(render(<StatusIndicator tone="warning" label="off" />)).toContain(
      "box-shadow:var(--accent-glow-amber)",
    );
  });

  it("muted tone carries no glow", () => {
    expect(render(<StatusIndicator tone="muted" label="…" />)).toContain(
      "box-shadow:none",
    );
  });
});

describe("shared/ui atoms StatusIndicator — source guards (ADR-0001 D5 / add-pattern)", () => {
  it("dot is aria-hidden (announcement comes from the label)", () => {
    expect(render(<StatusIndicator tone="muted" label="x" />)).toContain('aria-hidden');
  });

  it("no hardcoded colors in the atom source (tokens only)", () => {
    expect(statusIndicatorSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching in the atom source (AGENTS.md data rule)", () => {
    expect(statusIndicatorSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("atom imports only react (dumb, domain-free — add-pattern boundary)", () => {
    const importSources = statusIndicatorSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(importSources.length).toBeGreaterThan(0);
    for (const match of importSources) {
      expect(match).toBe('from "react"');
    }
  });
});
