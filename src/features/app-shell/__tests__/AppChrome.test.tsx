// @vitest-environment jsdom
/* features/app-shell AppChrome — DOM tests over the composed chrome
   (shell + telemetry indicator + bottom nav). fetch is stubbed with
   vi.stubGlobal (plan A7: tests never hit the network); the healthcheck
   interval is overridden with a long value (plan §8: timers must not keep
   tests alive). The composer store is module-global → resetComposerStatus()
   in afterEach. No jest-dom; globals off → explicit cleanup() and
   vi.unstubAllGlobals(). */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppChrome } from "../index";
import appChromeSource from "../ui/AppChrome.tsx?raw";
import composerStatusIndicatorSource from "../ui/ComposerStatusIndicator.tsx?raw";
import bottomNavSource from "../ui/BottomNav.tsx?raw";
import { resetComposerStatus } from "@shared/config/composerStatus";

const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>();

function healthResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as unknown as Response;
}

function renderChrome(
  fetchBehavior: () => Promise<Response>,
  children = <p>surface content</p>,
) {
  vi.stubGlobal("fetch", vi.fn(fetchBehavior));
  render(
    <MemoryRouter initialEntries={["/progress"]}>
      <AppChrome healthcheckIntervalMs={60_000}>{children}</AppChrome>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  resetComposerStatus();
});

describe("features app-shell AppChrome — telemetry header (plan A3)", () => {
  it("2xx healthcheck → 'AI Composer online' appears after the check", async () => {
    renderChrome(async () => healthResponse(200));
    expect(await screen.findByText("AI Composer online")).toBeTruthy();
  });

  it("failing healthcheck (503) → 'AI Composer offline'", async () => {
    renderChrome(async () => healthResponse(503));
    expect(await screen.findByText("AI Composer offline")).toBeTruthy();
  });

  it("network rejection → 'AI Composer offline'", async () => {
    renderChrome(async () => {
      throw new TypeError("network down");
    });
    expect(await screen.findByText("AI Composer offline")).toBeTruthy();
  });

  it("before the first result → muted 'AI Composer checking…'", () => {
    // A deferred fetch keeps the first check pending → store stays unknown.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    render(
      <MemoryRouter initialEntries={["/progress"]}>
        <AppChrome healthcheckIntervalMs={60_000}>
          <p>surface content</p>
        </AppChrome>
      </MemoryRouter>,
    );
    expect(screen.getByText("AI Composer checking…")).toBeTruthy();
    expect(screen.queryByText("AI Composer online")).toBeNull();
    expect(screen.queryByText("AI Composer offline")).toBeNull();
  });
});

describe("features app-shell AppChrome — bottom nav + surfaces", () => {
  it("renders one navigation region named 'Main navigation' with 2 tabs + the Logger FAB (stitch gate 2)", async () => {
    renderChrome(async () => healthResponse(200));
    const nav = await screen.findByRole("navigation", { name: "Main navigation" });
    const links = [...nav.querySelectorAll("a")];
    // 3 slots: flat My Plan + Progress flank the raised Logger FAB; Onboarding
    // stays off the bar (its route exists but is not a nav destination).
    expect(links).toHaveLength(3);
    expect(links[0].textContent).toBe("My Plan");
    expect(links[1].getAttribute("aria-label")).toBe("Logger");
    expect(links[1].getAttribute("href")).toBe("/logger");
    expect(links[2].textContent).toBe("Progress");
    expect(screen.queryByRole("link", { name: "Onboarding" })).toBeNull();
  });

  it("renders the two-line brand stack: 'Kinetix' over the composer indicator (stitch gate 1)", async () => {
    renderChrome(async () => healthResponse(200));
    const brand = document.querySelector(".app-shell__brand");
    expect(brand).not.toBeNull();
    expect(brand?.querySelector("h1")?.textContent).toBe("Kinetix");
    // Brand line 2 carries the telemetry indicator (appears after the check).
    expect(await screen.findByText("AI Composer online")).toBeTruthy();
    expect(brand?.textContent).toContain("AI Composer online");
  });

  it("renders the routed surface children inside the chrome", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    render(
      <MemoryRouter initialEntries={["/progress"]}>
        <AppChrome healthcheckIntervalMs={60_000}>
          <p>surface content</p>
        </AppChrome>
      </MemoryRouter>,
    );
    expect(screen.getByText("surface content")).toBeTruthy();
  });
});

describe("features app-shell — source guards (ADR-0001 D5 / FSAA data rule)", () => {
  it("no hardcoded colors in the feature UI sources (tokens only)", () => {
    for (const source of [appChromeSource, composerStatusIndicatorSource, bottomNavSource]) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
    }
  });

  it("no data fetching in the feature UI sources (AGENTS.md data rule)", () => {
    for (const source of [appChromeSource, composerStatusIndicatorSource, bottomNavSource]) {
      expect(source).not.toMatch(/fetch\s*\(|axios/i);
    }
  });
});

describe("features app-shell AppChrome — composition legality (plan §4)", () => {
  it("external imports stay within @shared/*, @entities/composer, react, react-router-dom", () => {
    const externalImports = [
      ...appChromeSource.matchAll(/from\s+"([^"]+)"/g),
    ].map((match) => match[1]).filter((path) => !path.startsWith("."));
    expect(externalImports.length).toBeGreaterThan(0);
    for (const importPath of externalImports) {
      // Relative "./BottomNav"/"./ComposerStatusIndicator" siblings are the
      // feature's own ui/ files — only external paths are gated.
      expect(importPath).toMatch(/^(@shared\b|@entities\/composer\b|react$|react-router-dom$)/);
    }
  });
});
