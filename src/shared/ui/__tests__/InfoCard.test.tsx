/* shared/ui atoms InfoCard — node-safe SSR tests + source guards. */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { InfoCard } from "../atoms/InfoCard";
import infoCardSource from "../atoms/InfoCard.tsx?raw";

function render(element: ReactElement): string {
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms InfoCard", () => {
  it("renders the title, description and tags", () => {
    const html = render(
      <InfoCard
        title="Smart watch"
        description="Health sync after each session"
        tags={["Steps", "Sleep", "Resting HR"]}
      />,
    );
    expect(html).toContain("<h3");
    expect(html).toContain(">Smart watch<");
    expect(html).toContain(">Health sync after each session<");
    expect(html).toContain(">Steps<");
    expect(html).toContain(">Sleep<");
    expect(html).toContain(">Resting HR<");
  });

  it("renders no list when tags are empty", () => {
    const html = render(
      <InfoCard title="Phone logger" description="Manual entry in Logger" tags={[]} />,
    );
    expect(html).not.toContain("<ul");
  });
});

describe("shared/ui atoms InfoCard — source guards", () => {
  it("contains no hex, rgb(), fetch() or axios", () => {
    expect(infoCardSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|fetch\s*\(|axios/i);
  });

  it("imports only react", () => {
    const imports = infoCardSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const importSource of imports) {
      expect(importSource).toBe('from "react"');
    }
  });
});
