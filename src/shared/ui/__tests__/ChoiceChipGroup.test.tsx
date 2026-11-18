/* shared/ui molecules ChoiceChipGroup — node-safe SSR test (repo convention:
   react-dom/server + ?raw source-scan; interaction is covered by the jsdom
   Onboarding test, which drives this molecule through the real feature). */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { ChoiceChipGroup } from "../molecules/ChoiceChipGroup";
import choiceChipGroupSource from "../molecules/ChoiceChipGroup.tsx?raw";

function render(element: ReactElement): string {
  // react-dom/server emits <!-- --> between adjacent text nodes — strip them
  // so text contents parse as plain text (same as ToggleChip.test.tsx).
  return renderToString(element).replaceAll("<!-- -->", "");
}

const OPTIONS = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
] as const;

describe("shared/ui molecules ChoiceChipGroup — behavior", () => {
  it("renders the legend and every option label with type=button chips", () => {
    const html = render(
      <ChoiceChipGroup
        legend="Intensity"
        options={OPTIONS}
        value="medium"
        onChange={() => {}}
      />,
    );
    expect(html).toContain(">Intensity</legend>");
    expect(html).toContain(">Low<");
    expect(html).toContain(">Medium<");
    expect(html).toContain(">High<");
    expect(html).toContain('type="button"');
  });

  it("exactly one chip is pressed: the one matching value; all others false", () => {
    const html = render(
      <ChoiceChipGroup
        legend="Intensity"
        options={OPTIONS}
        value="medium"
        onChange={() => {}}
      />,
    );
    expect(html.split('aria-pressed="true"').length - 1).toBe(1);
    // The pressed chip is the Medium one: its button opens right before the label.
    const pressedIndex = html.indexOf('aria-pressed="true"');
    const mediumIndex = html.indexOf(">Medium<");
    const lowIndex = html.indexOf(">Low<");
    expect(pressedIndex).toBeGreaterThan(-1);
    expect(pressedIndex).toBeLessThan(mediumIndex);
    expect(pressedIndex).toBeGreaterThan(lowIndex);
    expect(html.split('aria-pressed="false"').length - 1).toBe(OPTIONS.length - 1);
  });
});

describe("shared/ui molecules ChoiceChipGroup — source guards (ADR-0001 D5)", () => {
  it("no hardcoded colors in the molecule source (tokens only)", () => {
    expect(choiceChipGroupSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching in the molecule source (AGENTS.md data rule)", () => {
    expect(choiceChipGroupSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("imports only react and the ToggleChip atom (dumb, domain-free)", () => {
    const importSources = choiceChipGroupSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(importSources).toEqual([
      'from "react"',
      'from "@shared/ui/atoms/ToggleChip"',
    ]);
  });
});
