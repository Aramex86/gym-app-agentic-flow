/* shared/ui atoms CodeBlock — node-safe SSR tests + source guards. */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { CodeBlock } from "../atoms/CodeBlock";
import codeBlockSource from "../atoms/CodeBlock.tsx?raw";

function render(element: ReactElement): string {
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms CodeBlock", () => {
  it("renders code verbatim and exposes the region aria-label", () => {
    const code = "{\n  \"goals\": []\n}";
    const html = render(<CodeBlock label="Payload preview" code={code} />);
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Payload preview"');
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
    expect(html).toContain("{\n  &quot;goals&quot;: []\n}");
  });

  it("keeps whitespace inside the preformatted block", () => {
    const code = "line-1\n  indented-line-2";
    const html = render(<CodeBlock label="Preview" code={code} />);
    expect(html).toContain("line-1");
    expect(html).toContain("  indented-line-2");
  });
});

describe("shared/ui atoms CodeBlock — source guards", () => {
  it("contains no hex, rgb(), fetch() or axios", () => {
    expect(codeBlockSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|fetch\s*\(|axios/i);
  });

  it("imports only react", () => {
    const imports = codeBlockSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const importSource of imports) {
      expect(importSource).toBe('from "react"');
    }
  });
});
