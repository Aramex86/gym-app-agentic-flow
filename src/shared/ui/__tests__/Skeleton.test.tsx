/* shared/ui atoms Skeleton — node-safe SSR tests + source guards.
   Same style as InfoCard.test.tsx: renderToString, raw-source guards, no
   jest-dom, imports only the atom under test. */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { Skeleton } from "../atoms/Skeleton";
import skeletonSource from "../atoms/Skeleton.tsx?raw";

function render(element: ReactElement): string {
  return renderToString(element).replaceAll("<!-- -->", "");
}

function lineCount(html: string): number {
  return html.split('data-testid="skeleton-line"').length - 1;
}

describe("shared/ui atoms Skeleton", () => {
  it("announces loading politely with the requested accessible name", () => {
    const html = render(<Skeleton label="Loading AI review" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="Loading AI review"');
  });

  it("defaults to 3 placeholder bars and honours an explicit count", () => {
    expect(lineCount(render(<Skeleton label="Loading AI review" />))).toBe(3);
    expect(lineCount(render(<Skeleton label="Loading" lines={5} />))).toBe(5);
  });
});

describe("shared/ui atoms Skeleton — source guards", () => {
  it("contains no hex, rgb(), fetch() or axios", () => {
    expect(skeletonSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|fetch\s*\(|axios/i);
  });

  it("imports only react", () => {
    const imports = skeletonSource.match(/from\s+"([^"]+)"/g) ?? [];
    for (const importSource of imports) {
      expect(importSource).toBe('from "react"');
    }
  });
});
