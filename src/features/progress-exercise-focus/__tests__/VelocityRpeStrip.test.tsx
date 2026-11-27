/* features/progress-exercise-focus — VelocityRpeStrip SSR test (node env,
   renderToString — pure presentational component, no hooks/effects).
   Pins (plan §7.6 step 6): empty sets → header + mean + empty copy and
   ZERO tiles; 4 real samples → exactly 4 tiles with exactly one top set;
   tokens only. */

import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { VelocityRpeStrip } from "../ui/VelocityRpeStrip";
import velocityRpeStripSource from "../ui/VelocityRpeStrip.tsx?raw";

const SAMPLES = [
  { setNumber: 1, velocityMps: 0.65, rpe: 6 },
  { setNumber: 2, velocityMps: 0.62, rpe: 7 },
  { setNumber: 3, velocityMps: 0.5, rpe: 8, top: true },
  { setNumber: 4 }, // missing velocity+RPE → honest placeholders
];

describe("features/progress-exercise-focus VelocityRpeStrip — empty state", () => {
  it("empty sets → header + mean 'Ø —' + empty copy, ZERO tiles, no velocity numbers", () => {
    const html = renderToString(
      <VelocityRpeStrip
        title="Latest Velocity & RPE Profile"
        meanLabel="Mean"
        sets={[]}
        emptyLabel="Per-set velocity and RPE are not captured in the session log yet."
      />,
    );
    expect(html).toContain("Latest Velocity &amp; RPE Profile");
    expect(html).toContain("Mean");
    expect(html).toContain("Ø —");
    expect(html).toContain("not captured in the session log yet");
    // A3 data law: no fabricated tiles/values.
    expect(html).not.toContain("S1");
    expect(html).not.toContain("m/s");
    expect(html).toContain('aria-label="Latest Velocity &amp; RPE Profile"');
  });
});

describe("features/progress-exercise-focus VelocityRpeStrip — data state", () => {
  it("4 samples → one tile instance per sample, exactly one top", () => {
    const html = renderToString(
      <VelocityRpeStrip
        title="Latest Velocity & RPE Profile"
        meanLabel="Mean"
        meanVelocityMps={0.59}
        sets={SAMPLES}
        emptyLabel="unused when samples exist"
      />,
    );
    expect((html.match(/data-testid="velocity-set-tile"/g) ?? []).length).toBe(4);
    expect((html.match(/data-top="true"/g) ?? []).length).toBe(1);
    expect(html).toContain("S4");
    expect(html).toContain("Ø 0.59 m/s");
  });
});

describe("features/progress-exercise-focus VelocityRpeStrip — source guards", () => {
  it("no hardcoded colors (tokens only)", () => {
    expect(velocityRpeStripSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching (AGENTS.md data rule)", () => {
    expect(velocityRpeStripSource).not.toMatch(/fetch\s*\(|axios/i);
  });
});
