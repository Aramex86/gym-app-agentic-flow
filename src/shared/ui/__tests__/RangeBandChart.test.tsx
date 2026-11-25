// @vitest-environment jsdom
/* shared/ui atoms RangeBandChart — jsdom DOM test (recharts populates its
   chart state after mount via effects, so SSR strings are empty; same
   react-dom + raw role/attr assertion style as ExerciseFocusCharts.test.tsx
   — no jest-dom, globals off, explicit cleanup). Covers plan §9.2: bands =
   mean-mark rects + ErrorBar whiskers with native <title> tooltips,
   collapsed bands still render, mean-less bands keep the min–max-only
   tooltip title, single direct label, aria-label, zero bands → no output,
   and the ADR-0001 D5 source guards (tokens only, no data fetching,
   react+recharts imports only). */

import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { RangeBandChart } from "../atoms/RangeBandChart";
import rangeBandChartSource from "../atoms/RangeBandChart.tsx?raw";

afterEach(cleanup);

describe("shared/ui atoms RangeBandChart — behavior", () => {
  it("2 bands: 2 mean-mark rects with whiskers + titles, labels, one direct value", () => {
    const { container } = render(
      <RangeBandChart
        bands={[
          { label: "2026-10-29", min: 2100, max: 2560, mean: 2330 },
          { label: "2026-11-05", min: 2500, max: 2625, mean: 2562.5 },
        ]}
        unit="kg"
        ariaLabel="Squat weekly volume dispersion"
      />,
    );
    const html = container.innerHTML;
    // data-testid="range-band" lives on the outer figure (plan v2 §4) —
    // per-band marks are the range-mean rects + recharts-errorBar whiskers.
    expect(html.split('data-testid="range-band"').length - 1).toBe(1);
    expect(container.querySelectorAll('[data-testid="range-mean"]').length).toBe(2);
    expect(
      [...container.querySelectorAll('[class*="recharts-errorBar"]')].filter((el) =>
        el.classList.contains("recharts-errorBar"),
      ).length,
    ).toBe(2);
    expect(html).toContain("2026-10-29");
    expect(html).toContain("2026-11-05");
    // Band tooltip carries min–max (avg …) — the plan §6.2 format.
    const titles = [...container.querySelectorAll("title")].map((t) => t.textContent);
    expect(titles).toContain("2026-10-29: 2100 kg–2560 kg (avg 2330 kg)");
    expect(container.querySelector('[data-testid="range-value"]')?.textContent).toBe(
      "2562.5 kg",
    );
    const figure = container.querySelector('figure[role="img"]');
    expect(figure?.getAttribute("aria-label")).toBe("Squat weekly volume dispersion");
  });

  it("collapsed band (min === max) still renders; mean-less band has NO (avg …) marker", () => {
    const { container } = render(
      <RangeBandChart
        bands={[
          { label: "w1", min: 100, max: 100 },
          { label: "w2", min: 100, max: 200, mean: 150 },
        ]}
        ariaLabel="mixed"
      />,
    );
    // The marker IS the bar: every band renders one (midpoint-positioned
    // when the caller gave no mean) — plan v2 §4.
    const marks = [...container.querySelectorAll('[data-testid="range-mean"]')];
    expect(marks.length).toBe(2);
    // The mean-less band's tooltip shows only the min–max range.
    const titles = [...container.querySelectorAll("title")].map((t) => t.textContent);
    expect(titles).toContain("w1: 100–100");
    expect(titles).toContain("w2: 100–200 (avg 150)");
  });

  it("0 bands: nothing to draw → no chart output", () => {
    const { container } = render(<RangeBandChart bands={[]} ariaLabel="empty" />);
    expect(container.querySelector('[data-testid="range-band"]')).toBeNull();
    expect(container.innerHTML).toBe("");
  });

  it("pins tokens for marks, grid and text roles", () => {
    const { container } = render(
      <RangeBandChart bands={[{ label: "w1", min: 1, max: 2, mean: 1.5 }]} ariaLabel="x" />,
    );
    const html = container.innerHTML;
    expect(html).toContain("var(--accent-teal)");
    expect(html).toContain("var(--edge)");
    expect(html).toContain("var(--text-muted)");
    expect(html).toContain("var(--font-metric)");
    expect(html).toContain("var(--text-high)");
    // WHY no var(--surface) pin: the surface-stroked mean dot circle is
    // gone — plan v2 §4 replaces it with the Bar itself as the marker.
  });
});

describe("shared/ui atoms RangeBandChart — source guards (ADR-0001 D5)", () => {
  it("no hardcoded colors (tokens only)", () => {
    expect(rangeBandChartSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching (AGENTS.md data rule)", () => {
    expect(rangeBandChartSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("imports only react + recharts (dumb, domain-free)", () => {
    const imports = rangeBandChartSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const match of imports) {
      expect(["react", "recharts"]).toContain(match.slice(6, -1));
    }
  });
});
