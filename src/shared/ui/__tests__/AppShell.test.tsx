/* shared/ui AppShell — node-safe SSR smoke tests (no jsdom in the repo). */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { AppShell } from "../AppShell";
import { SITE } from "@shared/config/site";

describe("shared/ui AppShell", () => {
  it("renders without throwing", () => {
    expect(() =>
      renderToString(
        <AppShell>
          <p>content</p>
        </AppShell>,
      ),
    ).not.toThrow();
  });

  it("renders app title, default session status and shell structure", () => {
    const html = renderToString(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(html).toContain(SITE.name);
    expect(html).toContain("Session active");
    expect(html).toContain('class="app-shell"');
    expect(html).toContain("app-shell__header");
    expect(html).toContain("app-shell__main");
    expect(html).toContain("app-shell__footer");
  });

  it("styles via tokens only — no hardcoded colors or fonts", () => {
    const html = renderToString(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    for (const token of [
      "var(--canvas)",
      "var(--surface-lifted)",
      "var(--font-heading)",
      "var(--text-high)",
      "var(--text-muted)",
    ]) {
      expect(html).toContain(token);
    }
  });
});
