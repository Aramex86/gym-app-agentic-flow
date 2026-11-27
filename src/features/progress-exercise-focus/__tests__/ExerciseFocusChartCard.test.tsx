// @vitest-environment jsdom
/* features/progress-exercise-focus — DOM interaction test for the renamed
   ExerciseFocusChartCard (was ExerciseFocusCharts, plan A1). File-level
   environment directive keeps protected vite.config.ts untouched; same raw
   role/attr assertion style — no jest-dom, globals off, explicit cleanup +
   vi.unstubAllGlobals. One combined chart now (plan §1): exactly ONE
   recharts figure with Bar+Area+Line; sample data is never mutated (plan
   A5) — fixtures extend it with real sessions only. A fetch spy proves
   the feature makes ZERO network requests (plan §9.3). */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ExerciseFocusChartCard } from "../index";
import {
  setComposerStatus,
  resetComposerStatus,
  getComposerStatus,
} from "@shared/config/composerStatus";
import exerciseFocusCardSource from "../ui/ExerciseFocusChartCard.tsx?raw";
import type { SessionLogEntry } from "@entities/session-log";

const fetchSpy = vi.fn();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // Composer store is module-global: reset to the pristine "unknown" state
  // so no status leaks into another test's CTA (plan §9.3).
  resetComposerStatus();
});

function comboPoints(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[data-testid="combo-point"]')];
}

function comboBars(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[data-testid="combo-bar"]')];
}

function comboFigure(container: HTMLElement): Element | null {
  return container.querySelector('figure[role="img"]');
}

/* Two bench sessions in two distinct weekly buckets (window from
   2026-10-21): buckets start 10-21, 10-28, 11-04, 11-11 — the sessions of
   2026-11-10 and 2026-11-17 fill indices 2 and 3. */
const TWO_BUCKET_FIXTURE: SessionLogEntry[] = [
  {
    id: "s-2026-11-10-upper",
    date: "2026-11-10",
    split: "Upper",
    durationMin: 60,
    sets: [
      { exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 80, reps: 8, sets: 4 },
    ],
  },
  {
    id: "s-2026-11-17-upper",
    date: "2026-11-17",
    split: "Upper",
    durationMin: 60,
    sets: [
      { exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 82.5, reps: 8, sets: 4 },
    ],
  },
];

describe("features progress-exercise-focus — sample render (one combined chart)", () => {
  it("renders the region, legend, T1 pill, real e1RM + delta, ONE chart, 3 bars/dots", () => {
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(<ExerciseFocusChartCard onCompose={vi.fn()} />);

    const region = screen.getByRole("region", { name: "Exercise focus" });
    /* WHY within(focus): other sections share the "Exercise" string — the
       history table has an "Exercise" column too. */
    expect(region).toBeTruthy();

    const chips = [...screen.getAllByRole("button")].filter(
      (button) => button.getAttribute("aria-pressed") !== null,
    );
    expect(chips.length).toBe(5); // one chip per tracked exercise (A3)
    const pressed = chips.find((chip) => chip.getAttribute("aria-pressed") === "true");
    expect(pressed?.textContent).toBe("Back Squat"); // default = first alphabetically

    // Exactly ONE chart figure (plan §1 — the two stacked charts are gone).
    const figures = [...container.querySelectorAll('figure[role="img"]')];
    expect(figures.length).toBe(1);

    // Legend renders both series labels + the peak.
    expect(screen.getByText("1RM Trajectory")).toBeTruthy();
    expect(screen.getByText("Volume (Sets × Load)")).toBeTruthy();
    expect(screen.getByText("Peak: 122.5 kg e1RM")).toBeTruthy();

    // T1 pill (static display copy, plan A6) + header metric (plan A2).
    expect(screen.getByText("T1 Compound")).toBeTruthy();
    expect(container.querySelector('[data-testid="focus-e1rm"]')?.textContent).toBe("122.5 kg");
    expect(container.querySelector('[data-testid="focus-delta"]')?.textContent).toBe("+5.0%");

    // Sample = 3 populated weekly buckets → 3 dots AND 3 bars (plan A5).
    expect(comboPoints(container).length).toBe(3);
    expect(comboBars(container).length).toBe(3);

    // Strip title + honest empty copy (plan A3 — no fabricated tiles).
    expect(screen.getByText("Latest Velocity & RPE Profile")).toBeTruthy();
    expect(
      screen.getByText("Per-set velocity and RPE are not captured in the session log yet."),
    ).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="velocity-set-tile"]').length).toBe(0);

    // Incomplete-window hint unchanged (3 of 4 sample weeks).
    expect(
      screen.getByText(
        "3 of 4 weeks tracked — keep logging Back Squat to complete the trajectory.",
      ),
    ).toBeTruthy();
  });

  it("switching to Bench Press keeps ONE chart with bench pins (aria-label exact)", () => {
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(<ExerciseFocusChartCard onCompose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Bench Press" }));

    expect(container.querySelector('[data-testid="focus-e1rm"]')?.textContent).toBe("106.7 kg");
    expect(container.querySelector('[data-testid="focus-delta"]')?.textContent).toBe("+5.3%");
    expect(comboPoints(container).length).toBe(3);
    expect(comboBars(container).length).toBe(3);
    // Table-equivalent accessible label carries every value (plan Step 3).
    expect(comboFigure(container)?.getAttribute("aria-label")).toBe(
      "Bench Press 1RM trajectory and weekly volume: " +
        "WK44 101.3 kg 1RM, 2560 kg volume; " +
        "WK45 104.5 kg 1RM, 2640 kg volume; " +
        "WK46 106.7 kg 1RM, 3200 kg volume.",
    );
  });

  it("sample aria-label is the exact squat string (table-equivalent)", () => {
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(<ExerciseFocusChartCard onCompose={vi.fn()} />);
    expect(comboFigure(container)?.getAttribute("aria-label")).toBe(
      "Back Squat 1RM trajectory and weekly volume: " +
        "WK44 116.7 kg 1RM, 2500 kg volume; " +
        "WK45 116.7 kg 1RM, 2500 kg volume; " +
        "WK46 122.5 kg 1RM, 2625 kg volume.",
    );
  });
});

describe("features progress-exercise-focus — fewer than 4 weeks", () => {
  it("renders only the available points plus the 2-of-4 hint (no fill-forward)", () => {
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(
      <ExerciseFocusChartCard entries={TWO_BUCKET_FIXTURE} onCompose={vi.fn()} />,
    );

    expect(comboPoints(container).length).toBe(2);
    expect(comboBars(container).length).toBe(2);
    expect(
      screen.getByText(
        "2 of 4 weeks tracked — keep logging Bench Press to complete the trajectory.",
      ),
    ).toBeTruthy();
    // Only real bucket starts; no synthetic 10-21 / 10-28 points/labels.
    expect(container.textContent).not.toContain("2026-10-21");
    expect(container.textContent).not.toContain("2026-10-28");
  });
});

/* 4-bucket fixture (plan §6.2, also pinned in slice.test.ts): one Bench
   session per weekly bucket, window to = 2026-11-25 → bucket starts
   2026-10-29 / 11-05 / 11-12 / 11-19. All data flows through the entity
   selectors already proven by slice.test.ts. Module scope: the anchor
   fixture below extends it with one real pre-window session. */
const FOUR_BUCKET_FIXTURE: SessionLogEntry[] = [
  { id: "s-2026-11-04-upper", date: "2026-11-04", split: "Upper", durationMin: 60,
    sets: [{ exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 80, reps: 8, sets: 4 }] },
  { id: "s-2026-11-11-upper", date: "2026-11-11", split: "Upper", durationMin: 60,
    sets: [{ exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 82.5, reps: 8, sets: 4 }] },
  { id: "s-2026-11-18-upper", date: "2026-11-18", split: "Upper", durationMin: 60,
    sets: [{ exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 85, reps: 8, sets: 4 }] },
  { id: "s-2026-11-25-upper", date: "2026-11-25", split: "Upper", durationMin: 60,
    sets: [{ exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 90, reps: 8, sets: 4 }] },
];

describe("features progress-exercise-focus — full 4-week window (plan §6.2)", () => {
  it("renders all 4 bars/dots and NO incomplete hint at the full window", () => {
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(
      <ExerciseFocusChartCard entries={FOUR_BUCKET_FIXTURE} onCompose={vi.fn()} />,
    );

    expect(comboPoints(container).length).toBe(4);
    expect(comboBars(container).length).toBe(4);
    // 4 of 4 weeks → the hint disappears exactly at the full window.
    expect(screen.queryByText(/weeks tracked/)).toBeNull();
    // Delta vs the first data week (no anchor session): +12.5%.
    expect(container.querySelector('[data-testid="focus-delta"]')?.textContent).toBe("+12.5%");
  });
});

describe("features progress-exercise-focus — real base anchor (plan A4)", () => {
  /* The 4-bucket fixture plus one real pre-window bench session
     (2026-10-26 sits in the 7 days before from = 2026-10-29; Epley 75×8 =
     95.0 kg): the chart gains an anchor tick WK43 with no bar. */
  const ANCHOR_FIXTURE: SessionLogEntry[] = [
    ...FOUR_BUCKET_FIXTURE,
    { id: "s-2026-10-26-upper", date: "2026-10-26", split: "Upper", durationMin: 58,
      sets: [{ exerciseId: "barbell-bench-press", exerciseName: "Bench Press", weightKg: 75, reps: 8, sets: 1 }] },
  ];

  it("5 dots, 4 bars, first tick is the anchor's WK43, aria leads with 'base anchor'", () => {
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(
      <ExerciseFocusChartCard entries={ANCHOR_FIXTURE} onCompose={vi.fn()} />,
    );

    expect(comboPoints(container).length).toBe(5); // anchor + 4 data weeks
    expect(comboBars(container).length).toBe(4); // anchor has NO bar (plan A4)
    expect(
      comboFigure(container)?.getAttribute("aria-label")?.startsWith(
        "Bench Press 1RM trajectory and weekly volume: WK43 base anchor 95 kg 1RM; WK44",
      ),
    ).toBe(true);
  });
});

describe("features progress-exercise-focus — empty state + composer CTA", () => {
  it("entries=[] → EmptyState + CTA, no chart, ZERO fetch calls", () => {
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(<ExerciseFocusChartCard entries={[]} onCompose={vi.fn()} />);

    expect(screen.getByText("No tracked sets yet")).toBeTruthy();
    expect(
      screen.getByText("Log a session or compose a plan to start tracking this lift."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open AI composer" })).toBeTruthy();
    // No chips and no SVG charts in the empty state.
    expect(container.querySelectorAll("svg").length).toBe(0);
    expect(screen.queryByRole("button", { name: "Back Squat" })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("CTA is disabled ONLY for offline; click invokes onCompose", () => {
    vi.stubGlobal("fetch", fetchSpy);

    setComposerStatus("offline");
    const { unmount } = render(<ExerciseFocusChartCard entries={[]} onCompose={vi.fn()} />);
    expect(getComposerStatus()).toBe("offline");
    const cta = screen.getByRole("button", { name: "Open AI composer" }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    unmount();
    cleanup();

    for (const status of ["unknown", "online"] as const) {
      setComposerStatus(status);
      const onCompose = vi.fn();
      render(<ExerciseFocusChartCard entries={[]} onCompose={onCompose} />);
      const enabled = screen.getByRole("button", { name: "Open AI composer" }) as HTMLButtonElement;
      expect(enabled.disabled).toBe(false);
      fireEvent.click(enabled);
      expect(onCompose).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });
});

describe("features progress-exercise-focus — source guards (plan §9.3)", () => {
  it("no data fetching in the feature UI source (AGENTS.md data rule)", () => {
    expect(exerciseFocusCardSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("no hardcoded colors in the feature UI source (tokens only)", () => {
    expect(exerciseFocusCardSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("the card does NOT import the retired old-chart atoms (plan §1)", () => {
    expect(exerciseFocusCardSource).not.toMatch(/TrajectoryChart|RangeBandChart/);
  });
});
