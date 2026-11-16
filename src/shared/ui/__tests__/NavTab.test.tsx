/* shared/ui atoms NavTab — jsdom interaction tests: the atom owns the
   href/aria-current contract; the SPA-navigation behavior (preventDefault +
   onSelect) belongs to the feature (plan A8). No jest-dom; globals off →
   explicit cleanup() and vi.unstubAllGlobals() in afterEach. */

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NavTab } from "../atoms/NavTab";
import navTabSource from "../atoms/NavTab.tsx?raw";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("shared/ui atoms NavTab — link semantics (plan A8)", () => {
  it("active tab: real href link with aria-current=page", () => {
    render(<NavTab label="My Plan" href="/progress" active onSelect={() => {}} />);
    const link = screen.getByRole("link", { name: "My Plan" });
    expect(link.getAttribute("href")).toBe("/progress");
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("inactive tab: no aria-current attribute at all (not 'false')", () => {
    render(<NavTab label="Logger" href="/logger" active={false} onSelect={() => {}} />);
    const link = screen.getByRole("link", { name: "Logger" });
    expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("click prevents the default anchor hop and routes through onSelect", () => {
    const onSelect = vi.fn();
    render(<NavTab label="Logger" href="/logger" active={false} onSelect={onSelect} />);
    const link = screen.getByRole("link", { name: "Logger" });

    const defaultPrevented = fireEvent.click(link);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(defaultPrevented).toBe(false); // preventDefault was called
  });
});

describe("shared/ui atoms NavTab — token styling (ADR-0001 D5)", () => {
  it("active tab is a color-swap only: volt text on transparent, no pill/glow", () => {
    render(<NavTab label="My Plan" href="/progress" active onSelect={() => {}} />);
    const link = screen.getByRole("link", { name: "My Plan" });
    // WHY: stitch-appshell-ref §2 — active = color change only (NO background
    // pill, NO shadow), so both are pinned to their inactive values.
    expect(link.style.color).toBe("var(--accent-volt)");
    // jsdom's cssstyle normalizes the background shorthand getter to "none"
    // for "transparent" — assert the background-color property.
    expect(link.style.backgroundColor).toBe("transparent");
    expect(link.style.boxShadow).toBe("");
  });

  it("inactive tab is transparent with muted text", () => {
    render(<NavTab label="Logger" href="/logger" active={false} onSelect={() => {}} />);
    const link = screen.getByRole("link", { name: "Logger" });
    expect(link.style.backgroundColor).toBe("transparent");
    expect(link.style.color).toBe("var(--text-muted)");
  });
});

describe("shared/ui atoms NavTab — source guards (ADR-0001 D5 / add-pattern)", () => {
  it("no hardcoded colors in the atom source (tokens only)", () => {
    expect(navTabSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching in the atom source (AGENTS.md data rule)", () => {
    expect(navTabSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("atom imports only react (dumb, router-free — add-pattern boundary)", () => {
    const importSources = navTabSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(importSources.length).toBeGreaterThan(0);
    for (const match of importSources) {
      expect(match).toBe('from "react"');
    }
  });
});
