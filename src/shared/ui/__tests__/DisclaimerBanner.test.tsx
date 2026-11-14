/* shared/ui atoms DisclaimerBanner — node-safe SSR test (repo convention:
   react-dom/server + ?raw source-scan, same as ToggleChip.test.tsx; no
   jsdom needed for a stateless atom). Pins the exact D4 copy, the note
   semantics, the variant behavior and the tokens-only/no-fetch guards. */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { DisclaimerBanner } from "../atoms/DisclaimerBanner";
import disclaimerBannerSource from "../atoms/DisclaimerBanner.tsx?raw";

const BASE_LINE =
  "This plan is not medical advice. Stop and consult a professional if pain occurs.";
const DOCTOR_LINE =
  "You listed health conditions in your profile. Consult a doctor before starting this plan.";

function render(element: ReactElement): string {
  // react-dom/server emits <!-- --> between adjacent text nodes — strip them
  // so text contents parse as plain text (same as Button.test.tsx).
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms DisclaimerBanner — behavior", () => {
  it('variant="basic" renders the base line', () => {
    const html = render(<DisclaimerBanner variant="basic" />);
    expect(html).toContain(BASE_LINE);
  });

  it('variant="basic" does NOT render the doctor warning', () => {
    expect(render(<DisclaimerBanner variant="basic" />)).not.toContain(DOCTOR_LINE);
  });

  it('variant="disease" renders the doctor warning', () => {
    expect(render(<DisclaimerBanner variant="disease" />)).toContain(DOCTOR_LINE);
  });

  it('variant="disease" also renders the base line', () => {
    const html = render(<DisclaimerBanner variant="disease" />);
    expect(html).toContain(BASE_LINE);
    expect(html).toContain(DOCTOR_LINE);
  });

  it("renders note semantics", () => {
    expect(render(<DisclaimerBanner variant="basic" />)).toContain('role="note"');
  });

  it("passes className through to the rendered element", () => {
    const html = render(<DisclaimerBanner variant="basic" className="x" />);
    expect(html).toContain('class="x"');
  });
});

describe("shared/ui atoms DisclaimerBanner — source guards (ADR-0001 D5)", () => {
  it("no hardcoded colors in the atom source (tokens only)", () => {
    expect(disclaimerBannerSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("uses the disclaimer/warning token + surface tokens", () => {
    expect(disclaimerBannerSource).toContain("var(--accent-amber)");
    expect(disclaimerBannerSource).toContain("var(--surface)");
    expect(disclaimerBannerSource).toContain("var(--surface-lifted)");
  });

  it("no data fetching in the atom source (AGENTS.md data rule)", () => {
    expect(disclaimerBannerSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("atom imports only react (dumb, domain-free — add-pattern boundary)", () => {
    const importSources = disclaimerBannerSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(importSources.length).toBeGreaterThan(0);
    for (const match of importSources) {
      expect(match).toBe('from "react"');
    }
  });
});
