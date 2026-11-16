// @vitest-environment jsdom
/* features/app-shell BottomNav — DOM tests pinning the stitch 3-slot bar
   (gate decision 2): flat My Plan / Progress tabs flank a raised center FAB
   that targets /logger; Onboarding stays off the bar. The active slot is a
   pure function of the URL (plan A4): each scenario mounts a FRESH
   MemoryRouter at the surface path (a fresh mount at /logger restoring the
   FAB IS the reload-persistence proof). No jest-dom; globals off → explicit
   cleanup() and vi.unstubAllGlobals() in afterEach. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { BottomNav } from "../ui/BottomNav";
import bottomNavSource from "../ui/BottomNav.tsx?raw";

/** Accessible name of the aria-current link (the FAB is named via
    aria-label, its textContent is the icon-only SVG). */
function activeSlotName(): string | null {
  const current = document.querySelector('a[aria-current="page"]');
  if (!current) return null;
  return current.getAttribute("aria-label") ?? current.textContent;
}

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("features app-shell BottomNav — bar inventory (stitch gate 2)", () => {
  it("renders exactly 3 slots: My Plan, [FAB], Progress — no Onboarding link", () => {
    renderAt("/progress");
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const links = [...nav.querySelectorAll("a")];
    expect(links).toHaveLength(3);
    expect(links[0].textContent).toBe("My Plan");
    expect(links[1].getAttribute("aria-label")).toBe("Logger");
    expect(links[2].textContent).toBe("Progress");
    expect(screen.queryByRole("link", { name: "Onboarding" })).toBeNull();
  });

  it("the center FAB is a raised 52px volt circle targeting /logger", () => {
    renderAt("/progress");
    const fab = screen.getByRole("link", { name: "Logger" });
    expect(fab.getAttribute("href")).toBe("/logger");
    expect(fab.style.width).toBe("52px");
    expect(fab.style.height).toBe("52px");
    expect(fab.style.marginTop).toBe("-12px");
    expect(fab.style.borderRadius).toBe("var(--r-pill)");
    expect(fab.style.background).toBe("var(--accent-volt)");
    expect(fab.style.boxShadow).toBe("var(--accent-glow-volt)");
  });
});

describe("features app-shell BottomNav — active slot derives from the URL (plan A4)", () => {
  it("at /progress the My Plan tab is aria-current=page", () => {
    renderAt("/progress");
    expect(activeSlotName()).toBe("My Plan");
  });

  it("at / the Progress tab is aria-current=page", () => {
    renderAt("/");
    expect(activeSlotName()).toBe("Progress");
  });

  it("at an unknown path no slot is current (exact match, plan §5.1)", () => {
    renderAt("/orders");
    expect(activeSlotName()).toBeNull();
  });
});

describe("features app-shell BottomNav — SPA navigation", () => {
  it("clicking the FAB navigates to /logger and moves aria-current to it", () => {
    render(
      <MemoryRouter initialEntries={["/progress"]}>
        <Routes>
          <Route path="*" element={<BottomNav />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(activeSlotName()).toBe("My Plan");

    fireEvent.click(screen.getByRole("link", { name: "Logger" }));

    expect(activeSlotName()).toBe("Logger");
    expect(screen.getByRole("link", { name: "Logger" }).getAttribute("href")).toBe(
      "/logger",
    );
  });
});

describe("features app-shell BottomNav — reload persistence (plan A4)", () => {
  it("a fresh mount at /logger restores the FAB as current (URL is the store)", () => {
    renderAt("/logger");
    expect(activeSlotName()).toBe("Logger");
  });

  it("a fresh mount at /onboarding highlights nothing (off the bar)", () => {
    renderAt("/onboarding");
    expect(activeSlotName()).toBeNull();
  });
});

describe("features app-shell BottomNav — source guards", () => {
  it("no hardcoded colors in the source (tokens only)", () => {
    expect(bottomNavSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching in the source (AGENTS.md data rule)", () => {
    expect(bottomNavSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("imports only @shared/*, react, react-router-dom (no feature imports)", () => {
    const importPaths = [...bottomNavSource.matchAll(/from\s+"([^"]+)"/g)].map(
      (match) => match[1],
    );
    for (const importPath of importPaths) {
      expect(importPath).toMatch(/^(@shared|react$|react-router-dom$)/);
    }
  });
});
