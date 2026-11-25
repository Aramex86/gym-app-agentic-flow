// @vitest-environment jsdom
/* features/progress-history — DOM tests of the session log (task S7).
   The log itself performs ZERO fetch calls: PR badges come from the entity
   selectors, so fetch is stubbed with a spy and asserted NOT called. Also
   raw-source guards: no hex/rgb/fetch/axios in the feature UI files. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { HistoryLog } from "../ui/HistoryLog";
import historyLogSource from "../ui/HistoryLog.tsx?raw";
import historyLogRowSource from "../ui/HistoryLogRow.tsx?raw";
import { SESSION_LOG_SAMPLE } from "@entities/session-log";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function sessionRows(): HTMLElement[] {
  return screen.getAllByTestId("session-row");
}

describe("features/progress-history HistoryLog", () => {
  it("renders all 6 sample sessions newest-first with date, split and duration", () => {
    render(<HistoryLog />);

    const rows = sessionRows();
    expect(rows.length).toBe(6);
    expect(within(rows[0]!).getByText("2026-11-19").tagName).toBe("TIME");
    expect(within(rows[0]!).getByText("Lower")).toBeTruthy();
    expect(within(rows[0]!).getByText("72 min")).toBeTruthy();
    expect(within(rows[5]!).getByText("2026-11-02")).toBeTruthy();

    // Volume summary: 2 exercises x (5 squat + 3 RDL) = 8 sets of the
    // newest lower session (s-2026-11-19).
    expect(within(rows[0]!).getByText("2 exercises · 8 sets")).toBeTruthy();
  });

  it("renders exactly 3 PR badges, on the sessions of 11-09 / 11-16 / 11-19", () => {
    render(<HistoryLog />);

    const rows = sessionRows();
    const badgeCount = rows.reduce(
      (count, row) => count + within(row).queryAllByText("PR").length,
      0,
    );
    expect(badgeCount).toBe(3);
    for (const date of ["2026-11-09", "2026-11-16", "2026-11-19"]) {
      const row = rows.find((candidate) => within(candidate).queryByText(date) !== null);
      expect(row).toBeTruthy();
      expect(within(row!).queryAllByText("PR").length).toBe(1);
    }
    for (const date of ["2026-11-02", "2026-11-05", "2026-11-12"]) {
      const row = rows.find((candidate) => within(candidate).queryByText(date) !== null);
      expect(row).toBeTruthy();
      expect(within(row!).queryAllByText("PR").length).toBe(0);
    }
  });

  it("issues zero fetch calls and re-derives from injected entries (test seam)", () => {
    // vi.stubGlobal returns void — hold the spy explicitly.
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    render(<HistoryLog entries={SESSION_LOG_SAMPLE} />);

    expect(sessionRows().length).toBe(6);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows the muted empty state for an empty log", () => {
    render(<HistoryLog entries={[]} />);
    expect(screen.getByText("No sessions logged yet.")).toBeTruthy();
    expect(screen.queryByTestId("session-row")).toBeNull();
  });
});

describe("features/progress-history — source guards (no fetch, tokens only)", () => {
  it.each([["HistoryLog", historyLogSource], ["HistoryLogRow", historyLogRowSource]])(
    "%s contains no hex, rgb(), fetch() or axios",
    (_name, source) => {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|fetch\s*\(|axios/i);
    },
  );
});
