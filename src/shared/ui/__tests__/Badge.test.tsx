/* shared/ui atoms Badge — node-safe SSR tests + source guards.
   Same style as InfoCard.test.tsx: renderToString, raw-source guards, no
   jest-dom, imports only the atom under test. */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { Badge } from "../atoms/Badge";
import badgeSource from "../atoms/Badge.tsx?raw";

function render(element: ReactElement): string {
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms Badge", () => {
  it("renders the visible label", () => {
    const html = render(<Badge label="PR" />);
    expect(html).toContain(">PR<");
  });

  it("defaults to the volt tone and maps every tone to its token", () => {
    expect(render(<Badge label="PR" />)).toContain("var(--accent-volt)");
    expect(render(<Badge label="PR" tone="teal" />)).toContain("var(--accent-teal)");
    expect(render(<Badge label="PR" tone="amber" />)).toContain("var(--accent-amber)");
    expect(render(<Badge label="PR" tone="muted" />)).toContain("var(--text-muted)");
  });

  it("exposes the title as native tooltip and accessible detail", () => {
    const html = render(<Badge label="PR" title="New best on Back Squat" />);
    expect(html).toContain('title="New best on Back Squat"');
    expect(html).toContain('aria-label="New best on Back Squat"');
  });
});

describe("shared/ui atoms Badge — source guards", () => {
  it("contains no hex, rgb(), fetch() or axios", () => {
    expect(badgeSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|fetch\s*\(|axios/i);
  });

  it("imports only react", () => {
    const imports = badgeSource.match(/from\s+"([^"]+)"/g) ?? [];
    for (const importSource of imports) {
      expect(importSource).toBe('from "react"');
    }
  });
});
