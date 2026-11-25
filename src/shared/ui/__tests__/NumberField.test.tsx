/* shared/ui atoms NumberField — node-safe SSR test (repo convention:
   react-dom/server + ?raw source-scan; same pattern as SearchInput.test.tsx).
   Real typing behavior is covered by the jsdom Onboarding suite, which drives
   the atom through the real feature. Validation belongs to the entity, not
   the atom, so none is asserted here. */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { NumberField } from "../atoms/NumberField";
import numberFieldSource from "../atoms/NumberField.tsx?raw";

function render(invalid = false, required = true, hint?: string): string {
  // react-dom/server emits <!-- --> between adjacent text nodes — strip them
  // so text contents parse as plain text (same as SearchInput.test.tsx).
  return renderToString(
    <NumberField
      label="Age"
      value="30"
      onValueChange={() => {}}
      unit="years"
      min={13}
      max={100}
      step={1}
      placeholder="e.g. 30"
      required={required}
      invalid={invalid}
      hint={hint}
    />,
  ).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms NumberField — SSR output", () => {
  it("renders a type=number decimal input with the controlled value and placeholder", () => {
    const html = render();
    expect(html).toContain('type="number"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('value="30"');
    expect(html).toContain('placeholder="e.g. 30"');
  });

  it("associates a visible label with the input via for/id", () => {
    const html = render();
    expect(html).toContain(">Age</label>");

    const forAttribute = html.match(/<label[^>]*\bfor="([^"]+)"/)?.[1];
    const idAttribute = html.match(/<input[^>]*\bid="([^"]+)"/)?.[1];
    expect(forAttribute).toBeTruthy();
    expect(idAttribute).toBeTruthy();
    expect(forAttribute).toBe(idAttribute);
  });

  it("forwards min/max/step hints and the unit suffix text", () => {
    const html = render();
    expect(html).toContain('min="13"');
    expect(html).toContain('max="100"');
    expect(html).toContain('step="1"');
    expect(html).toContain(">years</span>");
  });

  it("aria-invalid=true only when invalid; aria-required=true when required", () => {
    expect(render(false, true)).toContain('aria-required="true"');
    expect(render(false, true)).not.toContain("aria-invalid");
    expect(render(true, true)).toContain('aria-invalid="true"');
    expect(render(false, false)).not.toContain("aria-required");
  });

  it("hint renders with aria-describedby only when present", () => {
    const withHint = render(false, true, "Age is required.");
    expect(withHint).toContain(">Age is required.</p>");
    expect(withHint).toContain("aria-describedby");

    const withoutHint = render(false, true);
    expect(withoutHint).not.toContain("aria-describedby");
    expect(withoutHint).not.toMatch(/<p/);
  });

  it("no maxlength anywhere (raw draft text is not truncated by the atom)", () => {
    expect(render()).not.toContain("maxlength");
  });

  it("disables browser autofill (autoComplete=off) and keeps the id stable via useId", () => {
    const html = render();
    // react-dom/server passes autoComplete through camelCased (not lowercase).
    expect(html).toContain('autoComplete="off"');
    // useId's SSR id is not derived from the label text.
    const id = html.match(/<input[^>]*\bid="([^"]+)"/)?.[1] ?? "";
    expect(id.toLowerCase()).not.toContain("age");
  });

  it("disabled is forwarded when set", () => {
    const html = renderToString(
      <NumberField label="Age" value="30" onValueChange={() => {}} disabled />,
    ).replaceAll("<!-- -->", "");
    expect(html).toContain("disabled");
  });
});

describe("shared/ui atoms NumberField — token styling (ADR-0001 D5)", () => {
  it("rendered styles pin the intended semantic tokens", () => {
    const html = render();
    const invalidHtml = render(true, true, "Age must be a whole number.");
    expect(html).toContain("var(--surface-lifted)");
    expect(html).toContain("var(--text-high)");
    expect(html).toContain("var(--text-muted)");
    expect(html).toContain("var(--edge)");
    // Amber is rendered only on the invalid edge/hint state.
    expect(invalidHtml).toContain("var(--accent-amber)");
    expect(html).toContain("var(--r-btn)");
    expect(html).toContain("var(--sp-sm)");
    expect(html).toContain("var(--sp-md)");
    expect(html).toContain("var(--sp-xs)");
    expect(html).toContain("var(--label-caps)");
    expect(html).toContain("var(--font-body)");
  });

  it("no hex/rgb leaks into the rendered output", () => {
    expect(render(true, true, "x")).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });
});

describe("shared/ui atoms NumberField — source guards (ADR-0001 D5)", () => {
  it("no hardcoded colors in the atom source (tokens only)", () => {
    expect(numberFieldSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching in the atom source (AGENTS.md data rule)", () => {
    expect(numberFieldSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("atom imports only react (dumb, domain-free — add-pattern boundary)", () => {
    const importSources = numberFieldSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(importSources.length).toBeGreaterThan(0);
    for (const match of importSources) {
      expect(match).toBe('from "react"');
    }
  });
});
