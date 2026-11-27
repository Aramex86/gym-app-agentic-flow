// @vitest-environment jsdom
/* shared/ui atoms ComboChart — jsdom DOM test (recharts populates its
   chart state after mount via effects, so SSR strings are empty; same
   style as TrajectoryChart.test.tsx — no jest-dom, globals off, explicit
   cleanup). Covers plan §7.6 step 2: Bar/Area/Line marks per row, null-bar
   anchor row behavior, the figure aria-label, native <title> marks with
   units, empty-points → no output, and the ADR-0001 D5 + ADR-0005 source
   guards (tokens only, no data fetching, react+recharts imports only). */

import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ComboChart } from "../atoms/ComboChart";
import comboChartSource from "../atoms/ComboChart.tsx?raw";
import type { ComboChartPoint } from "../atoms/ComboChart";

afterEach(cleanup);

const ROWS: ComboChartPoint[] = [
  { label: "WK44", barValue: 2500, lineValue: 116.7 },
  { label: "WK45", barValue: 2500, lineValue: 116.7 },
  { label: "WK46", barValue: 2625, lineValue: 122.5 },
  { label: "WK47", barValue: 2600, lineValue: 121 },
];

describe("shared/ui atoms ComboChart — behavior", () => {
  it("4 rows: 4 dots, 4 bars, an area + a line curve, labels, figure aria-label", () => {
    const { container } = render(
      <ComboChart points={ROWS} ariaLabel="test chart" barName="Volume" lineName="1RM" barUnit="kg" lineUnit="kg" />,
    );
    const html = container.innerHTML;
    expect(container.querySelectorAll('[data-testid="combo-point"]').length).toBe(4);
    expect(container.querySelectorAll('[data-testid="combo-bar"]').length).toBe(4);
    // Volt area fill under the line + linear line curve (no smoothing).
    expect(container.querySelector('[class*="recharts-area-area"]')).toBeTruthy();
    expect(container.querySelector('[class*="recharts-line-curve"]')).toBeTruthy();
    // Labels render in the HTML (x ticks), not just the DOM tree.
    expect(html).toContain("WK44");
    expect(html).toContain("WK45");
    expect(html).toContain("WK46");
    expect(html).toContain("WK47");
    const figure = container.querySelector('figure[role="img"]');
    expect(figure?.getAttribute("aria-label")).toBe("test chart");
  });

  it("native titles carry the units (bar + line marks)", () => {
    const { container } = render(
      <ComboChart points={ROWS} ariaLabel="titles" barUnit="kg" lineUnit="kg" />,
    );
    const titles = [...container.querySelectorAll("title")].map((title) => title.textContent);
    // Bar title: "<label>: <value> kg volume"; dot title: "... kg 1RM".
    expect(titles).toContain("WK44: 2500 kg volume");
    expect(titles).toContain("WK46: 2625 kg volume");
    expect(titles).toContain("WK46: 122.5 kg 1RM");
    expect(titles).toContain("WK47: 121 kg 1RM");
  });

  it("anchor row (barValue null): 4 dots but 3 bars, and no volume title for the anchor", () => {
    const anchored: ComboChartPoint[] = [
      { label: "WK43", barValue: null, lineValue: 95 },
      ...ROWS.slice(0, 3),
    ];
    const { container } = render(
      <ComboChart points={anchored} ariaLabel="anchored" barUnit="kg" lineUnit="kg" />,
    );
    expect(container.querySelectorAll('[data-testid="combo-point"]').length).toBe(4);
    expect(container.querySelectorAll('[data-testid="combo-bar"]').length).toBe(3);
    const titles = [...container.querySelectorAll("title")].map((title) => title.textContent);
    expect(titles).not.toContain("WK43: 0 kg volume");
    expect(titles).toContain("WK43: 95 kg 1RM");
  });

  it("empty points → no output at all", () => {
    const { container } = render(<ComboChart points={[]} ariaLabel="empty" />);
    expect(container.innerHTML).toBe("");
  });

  it("all-null values → no output (nothing to draw)", () => {
    const { container } = render(
      <ComboChart
        points={[
          { label: "a", barValue: null, lineValue: null },
          { label: "b", barValue: null, lineValue: null },
        ]}
        ariaLabel="ghost"
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("pins the design tokens for marks, grid and text roles", () => {
    const { container } = render(
      <ComboChart points={ROWS} ariaLabel="tokens" barUnit="kg" lineUnit="kg" />,
    );
    const html = container.innerHTML;
    expect(html).toContain("var(--accent-volt)");
    expect(html).toContain("var(--accent-teal)");
    expect(html).toContain("var(--edge)");
    expect(html).toContain("var(--text-muted)");
    expect(html).toContain("var(--font-metric)");
    // Tooltip ink (--text-high) mounts only on real hover — source pin.
    expect(comboChartSource).toContain("var(--text-high)");
    // Tooltip box mounts on hover too — same pattern as TrajectoryChart.
    expect(comboChartSource).toContain("var(--surface-lifted)");
  });
});

describe("shared/ui atoms ComboChart — source guards (ADR-0001 D5 / ADR-0005)", () => {
  it("no hardcoded colors (tokens only)", () => {
    expect(comboChartSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching (AGENTS.md data rule)", () => {
    expect(comboChartSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("imports only react + recharts (dumb, domain-free)", () => {
    const imports = comboChartSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const match of imports) {
      expect(["react", "recharts"]).toContain(match.slice(6, -1));
    }
  });
});
