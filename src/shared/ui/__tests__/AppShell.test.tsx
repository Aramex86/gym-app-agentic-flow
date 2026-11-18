/* shared/ui AppShell — node-safe SSR smoke tests (no jsdom in the repo).
   Chrome pins follow stitch-appshell-ref §1–2 as refined by the stitch gate:
   fixed 64px glass header (brand stack) + fixed glass nav bar. */

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

  it("header is a fixed 64px glass bar (stitch gate decision 1)", () => {
    const html = renderToString(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(html).toContain("position:fixed");
    expect(html).toContain("height:var(--shell-bar-h)");
    expect(html).toContain("background:var(--surface-glass)");
    expect(html).toContain("backdrop-filter:blur(12px)");
    expect(html).toContain("box-shadow:var(--shadow-glass-top)");
    // main is offset below the fixed bar
    expect(html).toContain("padding-top:var(--shell-bar-h)");
  });

  it("renders the two-line brand stack (title + header-right telemetry line)", () => {
    const html = renderToString(
      <AppShell headerRight={<span>telemetry</span>}>
        <p>content</p>
      </AppShell>,
    );
    expect(html).toContain('class="app-shell__brand"');
    expect(html).toContain("<h1");
    // headerRight renders in the second brand line, under the <h1>
    expect(html).toContain('class="app-shell__header-right"');
    expect(html).toContain("telemetry");
    const h1End = html.indexOf("</h1>");
    const headerRightStart = html.indexOf('class="app-shell__header-right"');
    expect(headerRightStart).toBeGreaterThan(h1End);
  });

  it("bottom nav slot is a fixed glass bar above the footer", () => {
    const html = renderToString(
      <AppShell bottomNav={<span>tabs</span>}>
        <p>content</p>
      </AppShell>,
    );
    expect(html).toContain('class="app-shell__nav"');
    expect(html).toContain("tabs");
    expect(html).toContain("box-shadow:var(--shadow-glass-bottom)");
    const mainEnd = html.indexOf("</main>");
    const navStart = html.indexOf('class="app-shell__nav"');
    const footerStart = html.indexOf('class="app-shell__footer"');
    expect(navStart).toBeGreaterThan(mainEnd);
    expect(footerStart).toBeGreaterThan(navStart);
  });

  it("clears the fixed nav bar with the footer's bottom margin", () => {
    const withNav = renderToString(
      <AppShell bottomNav={<span>tabs</span>}>
        <p>content</p>
      </AppShell>,
    );
    expect(withNav).toContain("margin-bottom:var(--shell-bar-h)");
  });

  it("omits the nav slot entirely when bottomNav is not given", () => {
    const html = renderToString(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    expect(html).not.toContain("app-shell__nav");
    // and then the footer needs no nav clearance
    expect(html).not.toContain("margin-bottom:var(--shell-bar-h)");
  });
});
