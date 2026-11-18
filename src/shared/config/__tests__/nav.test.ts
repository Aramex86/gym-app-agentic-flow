/* shared/config/nav — plain-data tests (node-safe; no React env needed).
   Pins the exact tab order/labels (task copy) and the A1 Surface↔route
   mapping that the rest of the shell relies on. */

import { describe, expect, it } from "vitest";
import {
  NAV_FAB_ID,
  NAV_SURFACES,
  NAV_TAB_IDS,
  activeNavSurface,
  navSurfaceById,
} from "../nav";

describe("shared/config nav — surface table", () => {
  it("lists the four tabs in task order with exact labels", () => {
    expect(NAV_SURFACES.map((surface) => surface.id)).toEqual([
      "my-plan",
      "progress",
      "logger",
      "onboarding",
    ]);
    expect(NAV_SURFACES.map((surface) => surface.label)).toEqual([
      "My Plan",
      "Progress",
      "Logger",
      "Onboarding",
    ]);
  });

  it("has distinct paths, all registered in src/pages/router.tsx", () => {
    const paths = [...new Set(NAV_SURFACES.map((surface) => surface.path))];
    expect(paths).toEqual(NAV_SURFACES.map((surface) => surface.path));
    expect(paths).toHaveLength(4);
  });

  it("bar layout is 3 slots: two flat tabs flank the Logger FAB (stitch gate 2)", () => {
    // Flat tabs on the bar; Onboarding stays off it (route still registered).
    expect(NAV_TAB_IDS).toEqual(["my-plan", "progress"]);
    expect(NAV_TAB_IDS).not.toContain("onboarding");
    expect(NAV_FAB_ID).toBe("logger");
    const fab = navSurfaceById(NAV_FAB_ID);
    expect(fab).toBeDefined();
    expect(fab?.label).toBe("Logger");
    expect(fab?.path).toBe("/logger");
    // Every bar slot resolves to a registered surface.
    for (const id of NAV_TAB_IDS) {
      expect(navSurfaceById(id)).toBeDefined();
    }
  });

  it("navSurfaceById returns undefined for unknown ids", () => {
    expect(navSurfaceById("nope" as never)).toBeUndefined();
  });
});

describe("shared/config nav — activeNavSurface (plan §5.1 exact match)", () => {
  it("maps each surface path to its id (A1 pairing)", () => {
    expect(activeNavSurface("/progress")).toBe("my-plan");
    expect(activeNavSurface("/")).toBe("progress");
    expect(activeNavSurface("/logger")).toBe("logger");
    expect(activeNavSurface("/onboarding")).toBe("onboarding");
  });

  it("returns null for unregistered paths (no false active tab)", () => {
    expect(activeNavSurface("/projects")).toBeNull();
    expect(activeNavSurface("/orders")).toBeNull();
  });
});
