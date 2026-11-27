/* features/progress-exercise-focus — ChartLegend SSR test (node env,
   renderToString — pure presentational component, no hooks/effects).
   Pins: both series labels render, the optional peak label renders or
   omits, tokens only (ADR-0001 D5). */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ChartLegend } from "../ui/ChartLegend";
import chartLegendSource from "../ui/ChartLegend.tsx?raw";

describe("features/progress-exercise-focus ChartLegend", () => {
  it("renders both series labels", () => {
    const html = renderToString(
      <ChartLegend lineLabel="1RM Trajectory" barLabel="Volume (Sets × Load)" />,
    );
    expect(html).toContain("1RM Trajectory");
    expect(html).toContain("Volume (Sets × Load)");
  });

  it("renders the optional peak label when provided", () => {
    const html = renderToString(
      <ChartLegend
        lineLabel="1RM Trajectory"
        barLabel="Volume (Sets × Load)"
        peakLabel="Peak: 122.5 kg e1RM"
      />,
    );
    expect(html).toContain("Peak: 122.5 kg e1RM");
  });

  it("omits the peak label when absent", () => {
    const html = renderToString(
      <ChartLegend lineLabel="1RM Trajectory" barLabel="Volume (Sets × Load)" />,
    );
    expect(html).not.toContain("Peak:");
  });

  it("swatches are aria-hidden and token-styled", () => {
    const html = renderToString(
      <ChartLegend lineLabel="line" barLabel="bar" peakLabel="Peak: 95 kg e1RM" />,
    );
    expect(html).toContain("var(--accent-volt)");
    expect(html).toContain("var(--accent-teal)");
    expect(html).toMatch(/aria-hidden="true"/);
  });
});

describe("features/progress-exercise-focus ChartLegend — source guards", () => {
  it("no hardcoded colors (tokens only)", () => {
    expect(chartLegendSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching (AGENTS.md data rule)", () => {
    expect(chartLegendSource).not.toMatch(/fetch\s*\(|axios/i);
  });
});
