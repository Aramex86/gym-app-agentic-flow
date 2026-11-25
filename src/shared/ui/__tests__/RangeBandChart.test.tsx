/* shared/ui atoms RangeBandChart — node-safe SSR test (same react-dom/
   server + ?raw source-scan pattern as StatCard.test.tsx). Covers plan
   §9.2: bands + mean markers, collapsed bands still render, mean-less
   bands render no marker, titles carry min–max (avg …), single direct
   label, aria-label, zero bands → no output, and the ADR-0001 D5 source
   guards (tokens only, no data fetching, react-only imports). */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { RangeBandChart } from "../atoms/RangeBandChart";
import rangeBandChartSource from "../atoms/RangeBandChart.tsx?raw";

function render(element: ReactElement): string {
  // react-dom/server emits <!-- --> between adjacent text nodes — strip
  // them so text contents parse as plain text (StatCard pattern).
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms RangeBandChart — behavior", () => {
  it("2 bands: 2 rects with mean markers, labels, titles, direct value", () => {
    const html = render(
      <RangeBandChart
        bands={[
          { label: "2026-10-29", min: 2100, max: 2560, mean: 2330 },
          { label: "2026-11-05", min: 2500, max: 2625, mean: 2562.5 },
        ]}
        unit="kg"
        ariaLabel="Squat weekly volume dispersion"
      />,
    );
    expect(html.split('data-testid="range-band"').length - 1).toBe(2);
    expect(html.split('data-testid="range-mean"').length - 1).toBe(2);
    expect(html).toContain("2026-10-29");
    expect(html).toContain("2026-11-05");
    // Native tooltip carries min–max (avg …) — the plan §6.2 format.
    expect(html).toContain("2100 kg–2560 kg (avg 2330 kg)");
    expect(html).toContain('data-testid="range-value"');
    expect(html).toContain("2562.5 kg"); // last mean direct label
    expect(html).toContain('aria-label="Squat weekly volume dispersion"');
    expect(html).toContain('role="img"');
  });

  it("collapsed band (min === max) still renders a band; mean-less band renders NO marker", () => {
    const html = render(
      <RangeBandChart
        bands={[
          { label: "w1", min: 100, max: 100 },
          { label: "w2", min: 100, max: 200, mean: 150 },
        ]}
        ariaLabel="mixed"
      />,
    );
    expect(html.split('data-testid="range-band"').length - 1).toBe(2);
    expect(html.split('data-testid="range-mean"').length - 1).toBe(1);
    // The mean-less band's tooltip shows only the min–max range.
    expect(html).toContain("w1: 100–100</title>");
  });

  it("0 bands: nothing to draw → empty output", () => {
    expect(render(<RangeBandChart bands={[]} ariaLabel="empty" />)).toBe("");
  });

  it("pins tokens for marks, grid and text roles", () => {
    const html = render(
      <RangeBandChart bands={[{ label: "w1", min: 1, max: 2, mean: 1.5 }]} ariaLabel="x" />,
    );
    expect(html).toContain("var(--accent-teal)");
    expect(html).toContain("var(--edge)");
    expect(html).toContain("var(--text-muted)");
    expect(html).toContain("var(--text-high)");
    expect(html).toContain("var(--surface)");
    expect(html).toContain("var(--font-metric)");
  });
});

describe("shared/ui atoms RangeBandChart — source guards (ADR-0001 D5)", () => {
  it("no hardcoded colors (tokens only)", () => {
    expect(rangeBandChartSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching (AGENTS.md data rule)", () => {
    expect(rangeBandChartSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("imports only react (dumb, domain-free)", () => {
    const imports = rangeBandChartSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const match of imports) expect(match).toBe('from "react"');
  });
});
