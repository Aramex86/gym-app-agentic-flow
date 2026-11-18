/* shared/ui atoms AlertBanner — node-safe SSR tests + source guards. */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { AlertBanner } from "../atoms/AlertBanner";
import alertBannerSource from "../atoms/AlertBanner.tsx?raw";

function render(element: ReactElement): string {
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms AlertBanner", () => {
  it("renders the message inside role=alert", () => {
    const html = render(
      <AlertBanner message="Could not generate your plan. Please try again." />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(">Could not generate your plan. Please try again.<");
  });
});

describe("shared/ui atoms AlertBanner — source guards", () => {
  it("contains no hex, rgb(), fetch() or axios", () => {
    expect(alertBannerSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|fetch\s*\(|axios/i);
  });

  it("imports only react", () => {
    const imports = alertBannerSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const importSource of imports) {
      expect(importSource).toBe('from "react"');
    }
  });
});
