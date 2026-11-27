/* features/progress-exercise-focus — VelocitySetTile SSR test (node env,
   renderToString — pure presentational component, no hooks/effects).
   Pins (plan §7.6 step 5): normal tile values, top tile emphasis (volt
   ring, data-top), honest missing-value placeholders ("—" / "RPE —"),
   tokens only. */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { VelocitySetTile } from "../ui/VelocitySetTile";
import velocitySetTileSource from "../ui/VelocitySetTile.tsx?raw";

describe("features/progress-exercise-focus VelocitySetTile", () => {
  it("normal tile: S2, 0.62 m/s, RPE 8 (volt RPE ink at the hard-set boundary)", () => {
    const html = renderToString(<VelocitySetTile setNumber={2} velocityMps={0.62} rpe={8} />);
    expect(html).toContain("S2");
    expect(html).toContain("0.62 m/s");
    expect(html).toContain("RPE 8");
    expect(html).toContain("var(--accent-volt)"); // RPE >= 8
    expect(html).toMatch(/data-top="false"/);
  });

  it("top tile: volt border + data-top true", () => {
    const html = renderToString(
      <VelocitySetTile setNumber={4} velocityMps={0.5} rpe={7} top />,
    );
    expect(html).toMatch(/data-top="true"/);
    expect(html).toContain("var(--accent-glow-volt)");
    expect(html).toContain("RPE 7"); // teal ink below 8 — checked via token below
  });

  it("missing values render the honest placeholders — never a fabricated number", () => {
    const html = renderToString(<VelocitySetTile setNumber={1} />);
    expect(html).toContain("S1");
    expect(html).toContain("—");
    expect(html).toContain("RPE —");
    expect(html).not.toContain("m/s");
  });

  it("light set RPE (< 8) uses the teal ink", () => {
    const html = renderToString(<VelocitySetTile setNumber={3} rpe={6} />);
    expect(html).toContain("var(--accent-teal)");
  });
});

describe("features/progress-exercise-focus VelocitySetTile — source guards", () => {
  it("no hardcoded colors (tokens only)", () => {
    expect(velocitySetTileSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching (AGENTS.md data rule)", () => {
    expect(velocitySetTileSource).not.toMatch(/fetch\s*\(|axios/i);
  });
});
