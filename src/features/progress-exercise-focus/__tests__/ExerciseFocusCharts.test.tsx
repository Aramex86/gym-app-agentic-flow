// @vitest-environment jsdom
/* features/progress-exercise-focus — DOM interaction test (file-level
   environment directive keeps protected vite.config.ts untouched; same raw
   role/attr assertion style as PlanRecompose.test.tsx — no jest-dom,
   globals off, explicit cleanup + vi.unstubAllGlobals). The sample data is
   never touched (plan A5): charts derive from the entity selectors already
   pinned by slice.test.ts. A fetch spy proves the feature makes ZERO
   network requests (plan §9.3). */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ExerciseFocusCharts } from "../index";
import {
  setComposerStatus,
  resetComposerStatus,
  getComposerStatus,
} from "@shared/config/composerStatus";
import exerciseFocusChartsSource from "../ui/ExerciseFocusCharts.tsx?raw";
import type { SessionLogEntry } from "@entities/session-log";

const fetchSpy = vi.fn();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // Composer store is module-global: reset to the pristine "unknown" state
  // so no status leaks into another test's CTA (plan §9.3).
  resetComposerStatus();
});

function trajectoryPoints(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[data-testid="trajectory-point"]')];
}

function lastTrajectoryLabel(container: HTMLElement): string {
  return container.querySelector('[data-testid="trajectory-value"]')?.textContent ?? "";
}

function lastVolumeLabel(container: HTMLElement): string {
  return container.querySelector('[data-testid="range-value"]')?.textContent ?? "";
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

describe("features progress-exercise-focus — sample render", () => {
  it("renders the region, legend, 5 chips, default Back Squat + both charts", () => {
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(<ExerciseFocusCharts onCompose={vi.fn()} />);

    const region = screen.getByRole("region", { name: "Exercise focus" });
    expect(screen.getByText("Exercise")).toBeTruthy();

    const chips = [...screen.getAllByRole("button")].filter(
      (button) => button.getAttribute("aria-pressed") !== null,
    );
    expect(chips.length).toBe(5); // one chip per tracked exercise (A3)
    const pressed = chips.find((chip) => chip.getAttribute("aria-pressed") === "true");
    expect(pressed?.textContent).toBe("Back Squat"); // default = first alphabetically

    expect(screen.getByText("4-week 1RM trajectory · Back Squat")).toBeTruthy();
    expect(screen.getByText("Volume dispersion · Back Squat")).toBeTruthy();

    // Sample = 3 populated weekly buckets (plan A5: no 4th point is added).
    expect(trajectoryPoints(container).length).toBe(3);
    expect(lastTrajectoryLabel(container)).toContain("122.5");
  });

  it("shows the incomplete-window hint (3 of 4 weeks tracked)", () => {
    vi.stubGlobal("fetch", fetchSpy);
    render(<ExerciseFocusCharts onCompose={vi.fn()} />);
    expect(
      screen.getByText(
        "3 of 4 weeks tracked — keep logging Back Squat to complete the trajectory.",
      ),
    ).toBeTruthy();
  });

  it("switching to Bench Press swaps both charts (bench pins)", () => {
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(<ExerciseFocusCharts onCompose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Bench Press" }));

    expect(screen.getByText("4-week 1RM trajectory · Bench Press")).toBeTruthy();
    expect(screen.getByText("Volume dispersion · Bench Press")).toBeTruthy();
    expect(lastTrajectoryLabel(container)).toContain("106.7 kg");
    expect(lastVolumeLabel(container)).toBe("3200 kg");
  });

  it("accessible names carry every value (table-equivalent aria-labels)", () => {
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(<ExerciseFocusCharts onCompose={vi.fn()} />);
    // Charts are recharts figures now (plan v2): role="img" moved from the
    // SVG surface (which recharts marks role="application") to the figure.
    const [trajectory, volume] = [...container.querySelectorAll('figure[role="img"]')];
    expect(trajectory?.getAttribute("aria-label")).toBe(
      "Back Squat estimated 1RM by week: week of 2026-10-30 116.7 kg; " +
        "week of 2026-11-06 116.7 kg; week of 2026-11-13 122.5 kg.",
    );
    // Sample squat weeks have min === max → collapsed format.
    expect(volume?.getAttribute("aria-label")).toBe(
      "Back Squat weekly volume dispersion: week of 2026-10-30 2500 kg; " +
        "week of 2026-11-06 2500 kg; week of 2026-11-13 2625 kg.",
    );
  });
});

describe("features progress-exercise-focus — fewer than 4 weeks", () => {
  it("renders only the available points plus the 2-of-4 hint (no fill-forward)", () => {
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(
      <ExerciseFocusCharts entries={TWO_BUCKET_FIXTURE} onCompose={vi.fn()} />,
    );

    expect(trajectoryPoints(container).length).toBe(2);
    expect(
      screen.getByText(
        "2 of 4 weeks tracked — keep logging Bench Press to complete the trajectory.",
      ),
    ).toBeTruthy();
    // Only real bucket starts; no synthetic 10-21 / 10-28 points.
    expect(container.textContent).not.toContain("2026-10-21");
    expect(container.textContent).not.toContain("2026-10-28");
  });
});

describe("features progress-exercise-focus — full 4-week window (plan §6.2)", () => {
  /* Same 4-bucket fixture the entity test pins (plan §6.2): one Bench
     session per weekly bucket, window to = 2026-11-25 → bucket starts
     2026-10-29 / 11-05 / 11-12 / 11-19. All data flows through the entity
     selectors already proven by slice.test.ts. */
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

  it("renders all 4 weekly points and NO incomplete hint at the full window", () => {
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(
      <ExerciseFocusCharts entries={FOUR_BUCKET_FIXTURE} onCompose={vi.fn()} />,
    );

    // "4 points, weekly": one dot per populated bucket, at most 4 — and a
    // rising 90×8 last point (e1RM 114 kg).
    expect(trajectoryPoints(container).length).toBe(4);
    expect(lastTrajectoryLabel(container)).toContain("114");
    // 4 of 4 weeks → the hint disappears exactly at the full window.
    expect(screen.queryByText(/weeks tracked/)).toBeNull();
    // One series per chart; the figcaptions name each series.
    expect(screen.getByText("4-week 1RM trajectory · Bench Press")).toBeTruthy();
    expect(screen.getByText("Volume dispersion · Bench Press")).toBeTruthy();
    // Volume top edge of the last (heaviest) week: 90×8×4.
    expect(lastVolumeLabel(container)).toBe("2880 kg");
  });
});

describe("features progress-exercise-focus — empty state + composer CTA", () => {
  it("entries=[] → EmptyState + CTA, no chart, ZERO fetch calls", () => {
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(<ExerciseFocusCharts entries={[]} onCompose={vi.fn()} />);

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
    const { unmount } = render(<ExerciseFocusCharts entries={[]} onCompose={vi.fn()} />);
    expect(getComposerStatus()).toBe("offline");
    const cta = screen.getByRole("button", { name: "Open AI composer" }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    unmount();
    cleanup();

    for (const status of ["unknown", "online"] as const) {
      setComposerStatus(status);
      const onCompose = vi.fn();
      render(<ExerciseFocusCharts entries={[]} onCompose={onCompose} />);
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
    expect(exerciseFocusChartsSource).not.toMatch(/fetch\s*\(|axios/i);
  });

  it("no hardcoded colors in the feature UI source (tokens only)", () => {
    expect(exerciseFocusChartsSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });
});
