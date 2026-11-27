// @vitest-environment jsdom
/* shared/ui atoms TrajectoryChart — jsdom DOM test (recharts populates its
   chart state after mount via effects, so SSR strings are empty; same
   react-dom + raw role/attr assertion style as ExerciseFocusCharts.test.tsx
   — no jest-dom, globals off, explicit cleanup). Covers plan §9.2: visible
   line = connecting path only for >= 2 points, one dot mark per populated
   point with native <title> tooltip, x labels, single direct label,
   aria-label + unit, zero points → no output, and the ADR-0001 D5 source
   guards (tokens only, no data fetching, react+recharts imports only). */

import { afterEach, describe, expect, it } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { TrajectoryChart } from "../atoms/TrajectoryChart";
import trajectoryChartSource from "../atoms/TrajectoryChart.tsx?raw";

afterEach(cleanup);

describe("shared/ui atoms TrajectoryChart — behavior", () => {
  it("3 points: connecting line, 3 dot marks with titles, labels, one direct value", () => {
    const { container } = render(
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
    const html = container.innerHTML;
    expect(container.querySelectorAll('[data-testid="trajectory-point"]').length).toBe(3);
    // Linear segments, no smoothing (data law: no invented shape).
    const curve = container.querySelector('[class*="recharts-line-curve"]');
    expect(curve?.getAttribute("d")).toContain("L");
    const titles = [...container.querySelectorAll("title")].map((t) => t.textContent);
    expect(titles).toContain("2026-10-30: 101.3 kg");
    expect(titles).toContain("2026-11-06: 104.5 kg");
    expect(titles).toContain("2026-11-13: 106.7 kg");
    expect(html).toContain("2026-10-30");
    expect(html).toContain("2026-11-06");
    expect(html).toContain("2026-11-13");
    const figure = container.querySelector('figure[role="img"]');
    expect(figure?.getAttribute("aria-label")).toBe("Bench Press 1RM by week");
    expect(container.querySelector('[data-testid="trajectory-value"]')?.textContent).toBe(
      "106.7 kg",
    );
  });

  it("1 point: one dot mark, NO connecting line (n < 2 has no curve path)", () => {
    const { container } = render(
      <TrajectoryChart points={[{ label: "w1", value: 120 }]} ariaLabel="one" />,
    );
    expect(
      container.querySelectorAll('[data-testid="trajectory-point"]').length,
    ).toBe(1);
    expect(container.querySelectorAll('[class*="recharts-line-curve"]').length).toBe(0);
  });

  it("0 points: nothing to draw → no chart output", () => {
    const { container } = render(<TrajectoryChart points={[]} ariaLabel="empty" />);
    expect(container.innerHTML).toBe("");
  });

  it("pins tokens for marks, grid and text roles", () => {
    const { container } = render(
      <TrajectoryChart
        points={[{ label: "a", value: 1 }, { label: "b", value: 2 }]}
        ariaLabel="x"
      />,
    );
    const html = container.innerHTML;
    expect(html).toContain("var(--accent-volt)");
    expect(html).toContain("var(--edge)");
    expect(html).toContain("var(--text-muted)");
    expect(html).toContain("var(--text-high)");
    expect(html).toContain("var(--surface)");
    expect(html).toContain("var(--font-metric)");
  });

  it("hover tooltip layer is token-styled (source pin — the box only mounts on real hover)", () => {
    // WHY the source pin, not a DOM pin: recharts mounts the tooltip box in
    // response to pointer move over the wrapper, which jsdom does not drive
    // deterministically for every run; the source guard rejects any
    // regression to the light-themed default box. The behavioral guarantee
    // stays with the native <title> assertions above.
    expect(trajectoryChartSource).toContain("var(--surface-lifted)"); // box
    expect(trajectoryChartSource).toContain("var(--edge)"); // box border + cursor
    expect(trajectoryChartSource).toContain("var(--text-high)"); // item ink
    expect(trajectoryChartSource).toContain("var(--text-muted)"); // label ink
  });
});

describe("shared/ui atoms TrajectoryChart — source guards (ADR-0001 D5)", () => {
  it("no hardcoded colors (tokens only)", () => {
    expect(trajectoryChartSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching (AGENTS.md data rule)", () => {
    expect(trajectoryChartSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("imports only react + recharts (dumb, domain-free)", () => {
    const imports = trajectoryChartSource.match(/from\s+"([^"]+)"/g) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const match of imports) {
      expect(["react", "recharts"]).toContain(match.slice(6, -1));
    }
  });
});
