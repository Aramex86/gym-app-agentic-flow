/* shared/ui atoms TrajectoryChart — node-safe SSR test (same react-dom/
   server + ?raw source-scan pattern as StatCard.test.tsx; jsdom is not
   needed — the atom renders pure SVG strings). Covers plan §9.2: polyline
   only for >= 2 points, one mark per point, x labels, single direct label,
   aria-label + unit, zero-points → no output, and the ADR-0001 D5 source
   guards (tokens only, no data fetching, react-only imports). */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { TrajectoryChart } from "../atoms/TrajectoryChart";
import trajectoryChartSource from "../atoms/TrajectoryChart.tsx?raw";

function render(element: ReactElement): string {
  // react-dom/server emits <!-- --> between adjacent text nodes — strip
  // them so text contents parse as plain text (StatCard pattern).
  return renderToString(element).replaceAll("<!-- -->", "");
}

describe("shared/ui atoms TrajectoryChart — behavior", () => {
  it("3 points: polyline, 3 marks with titles, labels, one direct value", () => {
    const html = render(
      <TrajectoryChart
        points={[
          { label: "2026-10-30", value: 101.3 },
          { label: "2026-11-06", value: 104.5 },
          { label: "2026-11-13", value: 106.7 },
        ]}
        unit="kg"
        ariaLabel="Bench Press 1RM by week"
      />,
    );
    expect(html).toContain("<polyline");
    expect(html.split('data-testid="trajectory-point"').length - 1).toBe(3);
    expect(html).toContain("2026-10-30");
    expect(html).toContain("2026-11-06");
    expect(html).toContain("2026-11-13");
    expect(html).toContain('data-testid="trajectory-value"');
    expect(html).toContain("106.7 kg"); // last point direct label with unit
    expect(html).toContain('aria-label="Bench Press 1RM by week"');
    expect(html).toContain('role="img"');
    // Native SVG tooltip per mark (no JS tooltip).
    expect(html).toContain("<title");
  });

  it("1 point: one circle, NO polyline (n < 2 has no connecting line)", () => {
    const html = render(
      <TrajectoryChart points={[{ label: "w1", value: 120 }]} ariaLabel="one" />,
    );
    expect(html.split("<circle").length - 1).toBe(1);
    expect(html).not.toContain("<polyline");
  });

  it("0 points: nothing to draw → empty output", () => {
    expect(render(<TrajectoryChart points={[]} ariaLabel="empty" />)).toBe("");
  });

  it("pins tokens for marks, grid and text roles", () => {
    const html = render(
      <TrajectoryChart
        points={[{ label: "a", value: 1 }, { label: "b", value: 2 }]}
        ariaLabel="x"
      />,
    );
    expect(html).toContain("var(--accent-volt)");
    expect(html).toContain("var(--edge)");
    expect(html).toContain("var(--text-muted)");
    expect(html).toContain("var(--text-high)");
    expect(html).toContain("var(--surface)");
    expect(html).toContain("var(--font-metric)");
  });
});

describe("shared/ui atoms TrajectoryChart — source guards (ADR-0001 D5)", () => {
  it("no hardcoded colors (tokens only)", () => {
    expect(trajectoryChartSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching (AGENTS.md data rule)", () => {
    expect(trajectoryChartSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("imports only react (dumb, domain-free)", () => {
    const imports = trajectoryChartSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const match of imports) expect(match).toBe('from "react"');
  });
});
