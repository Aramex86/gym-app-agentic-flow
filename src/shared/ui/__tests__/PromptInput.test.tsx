/* shared/ui atoms PromptInput — node-safe SSR test (repo convention: no jsdom
   outside the two DOM suites; same react-dom/server + ?raw source-scan
   pattern as SearchInput.test.tsx). Real typing/sending behavior is covered
   by the DOM tests in
   src/features/plan-recompose/__tests__/PlanRecompose.test.tsx and
   src/pages/__tests__/ProgressPage.recompose.test.tsx. */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { PromptInput } from "../atoms/PromptInput";
import promptInputSource from "../atoms/PromptInput.tsx?raw";

function render(): string {
  // react-dom/server emits <!-- --> between adjacent text nodes — strip them
  // so text contents parse as plain text (same as SearchInput.test.tsx).
  return renderToString(
    <PromptInput
      label="Re-compose instruction"
      value="add a deload week"
      placeholder="e.g. Add a deload week and reduce volume"
      onValueChange={() => {}}
    />,
  ).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms PromptInput — SSR output", () => {
  it("renders a textarea with the controlled value, placeholder and default rows", () => {
    const html = render();
    expect(html).toContain("<textarea");
    expect(html).toContain("add a deload week");
    expect(html).toContain('rows="3"');
    expect(html).toContain('placeholder="e.g. Add a deload week and reduce volume"');
  });

  it("associates a visible label with the textarea via for/id", () => {
    const html = render();
    expect(html).toContain(">Re-compose instruction</label>");

    const forAttribute = html.match(/<label[^>]*\bfor="([^"]+)"/)?.[1];
    const idAttribute = html.match(/<textarea[^>]*\bid="([^"]+)"/)?.[1];
    expect(forAttribute).toBeTruthy();
    expect(idAttribute).toBeTruthy();
    expect(forAttribute).toBe(idAttribute);
  });

  it("renders rows=1 when the owner passes rows", () => {
    const html = renderToString(
      <PromptInput label="L" value="" rows={1} onValueChange={() => {}} />,
    );
    expect(html).toContain('rows="1"');
  });

  it("renders disabled='' when disabled is passed (frozen while a request is pending)", () => {
    const html = renderToString(
      <PromptInput label="L" value="" disabled onValueChange={() => {}} />,
    );
    expect(html).toContain("disabled=");
  });

  it("disables browser autofill and keeps the id stable via useId", () => {
    const html = render();
    expect(html).toContain('autoComplete="off"');
    const id = html.match(/<textarea[^>]*\bid="([^"]+)"/)?.[1] ?? "";
    expect(id.toLowerCase()).not.toContain("re-compose");
  });
});

describe("shared/ui atoms PromptInput — token styling (ADR-0001 D5)", () => {
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

describe("shared/ui atoms PromptInput — source guards (ADR-0001 D5)", () => {
  it("no hardcoded colors in the atom source (tokens only)", () => {
    expect(promptInputSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching in the atom source (AGENTS.md data rule)", () => {
    expect(promptInputSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("atom imports only react (dumb, domain-free — add-pattern boundary)", () => {
    const importSources = promptInputSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(importSources.length).toBeGreaterThan(0);
    for (const match of importSources) {
      expect(match).toBe('from "react"');
    }
  });
});
