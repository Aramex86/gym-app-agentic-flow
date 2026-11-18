/* shared/ui atoms SearchInput — node-safe SSR test (repo convention: no jsdom
   outside the pages interaction test; same react-dom/server + ?raw
   source-scan pattern as ToggleChip.test.tsx). Real typing/clearing behavior
   is covered by the DOM test in
   src/features/training-history-search/__tests__/TrainingHistorySearch.test.tsx. */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SearchInput } from "../atoms/SearchInput";
import searchInputSource from "../atoms/SearchInput.tsx?raw";

function render(): string {
  // react-dom/server emits <!-- --> between adjacent text nodes — strip them
  // so text contents parse as plain text (same as ToggleChip.test.tsx).
  return renderToString(
    <SearchInput
      label="Search exercises"
      value="squat"
      placeholder="Search by exercise name"
      onValueChange={() => {}}
    />,
  ).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms SearchInput — SSR output", () => {
  it("renders a type=search input with the controlled value and placeholder", () => {
    const html = render();
    expect(html).toContain('type="search"');
    expect(html).toContain('value="squat"');
    expect(html).toContain('placeholder="Search by exercise name"');
  });

  it("associates a visible label with the input via for/id", () => {
    const html = render();
    expect(html).toContain(">Search exercises</label>");

    const forAttribute = html.match(/<label[^>]*\bfor="([^"]+)"/)?.[1];
    const idAttribute = html.match(/<input[^>]*\bid="([^"]+)"/)?.[1];
    expect(forAttribute).toBeTruthy();
    expect(idAttribute).toBeTruthy();
    expect(forAttribute).toBe(idAttribute);
  });

  it("disables browser autofill (autoComplete=off) and keeps the id stable via useId", () => {
    const html = render();
    // react-dom/server passes autoComplete through camelCased (not lowercase).
    expect(html).toContain('autoComplete="off"');
    // useId's SSR shape is deterministic (e.g. «r1» / «:r1:» — always same
    // for the same tree); assert the id is not derived from the label text.
    const id = html.match(/<input[^>]*\bid="([^"]+)"/)?.[1] ?? "";
    expect(id.toLowerCase()).not.toContain("search");
  });
});

describe("shared/ui atoms SearchInput — token styling (ADR-0001 D5)", () => {
  it("rendered styles pin the intended semantic tokens", () => {
    const html = render();
    expect(html).toContain("var(--surface-lifted)");
    expect(html).toContain("var(--text-high)");
    expect(html).toContain("var(--text-muted)");
    expect(html).toContain("var(--edge)");
    expect(html).toContain("var(--r-btn)");
    expect(html).toContain("var(--sp-sm)");
    expect(html).toContain("var(--sp-md)");
    expect(html).toContain("var(--sp-xs)");
    expect(html).toContain("var(--label-caps)");
    expect(html).toContain("var(--font-body)");
  });
});

describe("shared/ui atoms SearchInput — source guards (ADR-0001 D5)", () => {
  it("no hardcoded colors in the atom source (tokens only)", () => {
    expect(searchInputSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching in the atom source (AGENTS.md data rule)", () => {
    expect(searchInputSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("atom imports only react (dumb, domain-free — add-pattern boundary)", () => {
    const importSources = searchInputSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(importSources.length).toBeGreaterThan(0);
    for (const match of importSources) {
      expect(match).toBe('from "react"');
    }
  });
});
