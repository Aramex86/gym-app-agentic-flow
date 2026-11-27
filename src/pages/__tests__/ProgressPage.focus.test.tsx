// @vitest-environment jsdom
/* pages ProgressPage — exercise-focus block placement (plan §9.4). jsdom
   via file-level directive; the insight gate request is stubbed globally
   (same pattern as ProgressPage.test.tsx) and the stub spy asserts the
   chart adds ZERO extra network requests — only /api/progress/insight is
   ever called. Cleanup/unstub explicit (globals off). */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { ProgressPage } from "../ProgressPage";
import { INSIGHT_ENDPOINT } from "@entities/session-log";

const fetchStub = vi.fn((url: RequestInfo | URL, _init?: RequestInit) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        periodId: "last-4-weeks",
        model: "kimi-k3.1",
        insight: "Bench progressed twice; squat PR at 122.5 kg e1RM.",
      }),
  } as unknown as Response),
);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("pages ProgressPage — exercise focus block (plan §8.3)", () => {
  it("renders the focus region with ONE combined chart BETWEEN insight and history", async () => {
    vi.stubGlobal("fetch", fetchStub);
    render(<ProgressPage />);

    const insight = screen.getByRole("region", { name: "AI review insight" });
    const focus = screen.getByRole("region", { name: "Exercise focus" });
    const history = screen.getByRole("region", { name: "Session history" });

    const following = (a: Element, b: Element) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(following(insight, focus)).toBe(true);
    expect(following(focus, history)).toBe(true);

    // Exactly ONE chart figure inside the focus block (plan §1: the two
    // stacked charts merged into one ComposedChart).
    expect(focus.querySelectorAll('figure[role="img"]').length).toBe(1);
    // Legend labels render (both series + peak, Back Squat default).
    expect(within(focus).getByText("1RM Trajectory")).toBeTruthy();
    expect(within(focus).getByText("Volume (Sets × Load)")).toBeTruthy();
    expect(within(focus).getByText("Peak: 122.5 kg e1RM")).toBeTruthy();
    // Velocity/RPE strip: title + honest empty copy (plan A3).
    expect(within(focus).getByText("Latest Velocity & RPE Profile")).toBeTruthy();
    expect(
      within(focus).getByText(
        "Per-set velocity and RPE are not captured in the session log yet.",
      ),
    ).toBeTruthy();
    // Selector + hint render alongside (3 of 4 populated sample weeks).
    // WHY within(focus): the history table also has an "Exercise" column.
    expect(within(focus).getByText("Exercise")).toBeTruthy();
    expect(
      within(focus).getByText(
        "3 of 4 weeks tracked — keep logging Back Squat to complete the trajectory.",
      ),
    ).toBeTruthy();
  });

  it("makes ZERO requests beyond the insight endpoint (the chart derives client-side)", async () => {
    vi.stubGlobal("fetch", fetchStub);
    render(<ProgressPage />);
    await screen.findByRole("region", { name: "AI review insight" });

    // Every single fetch call targeted /api/progress/insight — the focus
    // chart never touches the network (no synthetic data source, plan §1).
    expect(fetchStub.mock.calls.length).toBeGreaterThan(0);
    for (const [url] of fetchStub.mock.calls) {
      expect(String(url)).toBe(INSIGHT_ENDPOINT);
    }
  });
});
