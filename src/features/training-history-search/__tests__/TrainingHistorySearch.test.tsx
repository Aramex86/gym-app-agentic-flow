// @vitest-environment jsdom
/* features/training-history-search — the repo's second DOM interaction test
   (file-level environment directive keeps protected vite.config.ts untouched
   and every other suite node-safe). No jest-dom: raw role/attribute
   assertions. Vitest globals are off and no global setup exists, so cleanup
   is invoked explicitly (same pattern as ProgressPage.test.tsx). Real DOM
   interaction with the real input, real entity filter, real HistoryTable. */

import { afterEach, describe, expect, it } from "vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import { TrainingHistorySearch } from "../ui/TrainingHistorySearch";
import { SAMPLE_PLAN } from "@shared/config/plan.sample";

function searchbox(): HTMLInputElement {
  return screen.getByRole("searchbox", {
    name: "Search exercises",
  }) as HTMLInputElement;
}

function historyRows(): HTMLElement[] {
  return screen.getAllByTestId("history-row");
}

afterEach(() => cleanup());

describe("features TrainingHistorySearch", () => {
  it("starts with an empty controlled searchbox and all 40 sample rows", () => {
    const { container } = render(<TrainingHistorySearch />);

    const input = searchbox();
    expect(input.getAttribute("type")).toBe("search");
    expect(input.getAttribute("placeholder")).toBe("Search by exercise name");
    expect(input.value).toBe("");

    const derived = SAMPLE_PLAN.weeks
      .flatMap((week) => week.days)
      .flatMap((day) => day.exercises).length;
    expect(historyRows().length).toBe(derived);
    // Acceptance pin from the plan: 4 weeks x 2 days x 5 exercises.
    expect(historyRows().length).toBe(40);

    expect(container.querySelectorAll("table").length).toBe(1);
  });

  it('typing "back squat" filters immediately to four Back Squat rows', () => {
    render(<TrainingHistorySearch />);

    fireEvent.change(searchbox(), { target: { value: "back squat" } });

    const rows = historyRows();
    expect(rows.length).toBe(4);
    for (const row of rows) {
      const cells = within(row).getAllByRole("cell");
      expect(cells[2].textContent).toBe("Back Squat");
    }
    expect(screen.queryByText("No history yet")).toBeNull();
  });

  it("matching is case-insensitive and whitespace-tolerant", () => {
    render(<TrainingHistorySearch />);

    fireEvent.change(searchbox(), { target: { value: "  BACK Squat  " } });

    expect(historyRows().length).toBe(4);
    for (const row of historyRows()) {
      expect(within(row).getAllByRole("cell")[2].textContent).toBe("Back Squat");
    }
  });

  it("an unmatched query shows zero rows and the existing No history yet empty state", () => {
    render(<TrainingHistorySearch />);

    fireEvent.change(searchbox(), { target: { value: "burpee" } });

    expect(screen.queryAllByTestId("history-row").length).toBe(0);
    expect(screen.getByText("No history yet")).toBeTruthy();
  });

  it("clearing the query restores all 40 rows and keeps the input controlled", () => {
    render(<TrainingHistorySearch />);

    fireEvent.change(searchbox(), { target: { value: "squat" } });
    expect(historyRows().length).toBeGreaterThan(0);
    expect((searchbox() as HTMLInputElement).value).toBe("squat");

    fireEvent.change(searchbox(), { target: { value: "" } });

    expect(historyRows().length).toBe(40);
    expect((searchbox() as HTMLInputElement).value).toBe("");
  });

  it("a split-term query does not match (exercise names are the search target)", () => {
    render(<TrainingHistorySearch />);

    fireEvent.change(searchbox(), { target: { value: "Upper" } });

    expect(screen.queryAllByTestId("history-row").length).toBe(0);
  });
});
