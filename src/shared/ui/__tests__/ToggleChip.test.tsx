/* shared/ui atoms ToggleChip — node-safe SSR test (repo convention: no jsdom
   outside the pages interaction test; same react-dom/server + ?raw
   source-scan pattern as Button.test.tsx). Click behavior (aria-pressed
   flipping with real events) is covered by the DOM test in
   src/pages/__tests__/ProgressPage.test.tsx. */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { ToggleChip } from "../atoms/ToggleChip";
import toggleChipSource from "../atoms/ToggleChip.tsx?raw";

function render(element: ReactElement): string {
  // react-dom/server emits <!-- --> between adjacent text nodes — strip them
  // so text contents parse as plain text (same as Button.test.tsx).
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms ToggleChip — behavior", () => {
  it("renders the given label with type=button", () => {
    const html = render(<ToggleChip on={false} onToggle={() => {}} label="Compact" />);
    expect(html).toContain(">Compact<");
    expect(html).toContain('type="button"');
  });

  it('renders aria-pressed="false" when on={false}', () => {
    expect(
      render(<ToggleChip on={false} onToggle={() => {}} label="Compact" />),
    ).toContain('aria-pressed="false"');
  });

  it('renders aria-pressed="true" when on={true}', () => {
    expect(
      render(<ToggleChip on={true} onToggle={() => {}} label="Compact" />),
    ).toContain('aria-pressed="true"');
  });
});

describe("shared/ui atoms ToggleChip — token styling", () => {
  it("off state pins surface-lifted text on text-high", () => {
    const html = render(<ToggleChip on={false} onToggle={() => {}} label="Compact" />);
    expect(html).toContain("var(--surface-lifted)");
    expect(html).toContain("var(--text-high)");
  });

  it("on state pins accent-volt text on canvas", () => {
    const html = render(<ToggleChip on={true} onToggle={() => {}} label="Compact" />);
    expect(html).toContain("var(--accent-volt)");
    expect(html).toContain("var(--canvas)");
  });

  it("both states share the pill/edge/label token chrome", () => {
    const html = render(<ToggleChip on={false} onToggle={() => {}} label="Compact" />);
    expect(html).toContain("var(--edge)");
    expect(html).toContain("var(--r-pill)");
    expect(html).toContain("var(--sp-xs)");
    expect(html).toContain("var(--sp-sm)");
    expect(html).toContain("var(--label-caps)");
  });
});

describe("shared/ui atoms ToggleChip — source guards (ADR-0001 D5)", () => {
  it("no hardcoded colors in the atom source (tokens only)", () => {
    expect(toggleChipSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching in the atom source (AGENTS.md data rule)", () => {
    expect(toggleChipSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("atom imports only react (dumb, domain-free — add-pattern boundary)", () => {
    const importSources = toggleChipSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(importSources.length).toBeGreaterThan(0);
    for (const match of importSources) {
      expect(match).toBe('from "react"');
    }
  });
});
