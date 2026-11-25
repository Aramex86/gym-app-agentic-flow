// @vitest-environment jsdom
/* pages ProgressPage — session log + offline degradation of the AI review
   card (task S7). jsdom via file-level directive; fetch stub globally
   REJECTED for /api/progress/insight so the page proves the history log and
   its PR badges keep working when the insight request fails, and shows the
   insight Retry action. Cleanup/unstub explicit (globals off). */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProgressPage } from "../ProgressPage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("pages ProgressPage — session log + offline insight (task A7)", () => {
  it("renders the 6 session rows and 3 PR badges while the insight request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

    render(<ProgressPage />);

    // Offline degradation: the log (and its 3 PR badges) still renders.
    const rows = await screen.findAllByTestId("session-row");
    expect(rows.length).toBe(6);
    const prBadges = rows.reduce(
      (count, row) => count + (row.textContent?.includes("· e1RM") ? 1 : 0),
      0,
    );
    expect(prBadges).toBe(3);

    // The failed card surfaces its error alert plus the Retry action.
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();

    // The insight text itself never appears.
    expect(screen.queryByRole("status", { name: "Loading AI review" })).toBeNull();
  });

  it("orders: metric cards -> AI review -> session history -> plan matrix", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

    const { container } = render(<ProgressPage />);

    const metricRow = screen.getByText("Weeks").parentElement!.parentElement!;
    const insight = screen.getByRole("region", { name: "AI review insight" });
    const history = screen.getByRole("region", { name: "Session history" });
    const matrix = screen.getByRole("region", { name: "Training history" });

    const following = (a: Element, b: Element) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(following(metricRow, insight)).toBe(true);
    expect(following(insight, history)).toBe(true);
    expect(following(history, matrix)).toBe(true);
    expect(container).toBeTruthy();
  });
});
