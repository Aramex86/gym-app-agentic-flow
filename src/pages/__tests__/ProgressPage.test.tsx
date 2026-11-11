// @vitest-environment jsdom
/* pages ProgressPage — the repo's only DOM interaction test (task requires
   fireEvent; isolated here via the file-level environment directive so the
   protected vite.config.ts stays untouched and all other suites stay
   node-safe). No jest-dom: raw role/attribute assertions. Vitest globals are
   off and no global setup exists, so cleanup is invoked explicitly. */

import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import { ProgressPage } from "../ProgressPage";
import { HistoryTable, ToggleChip } from "@shared/ui";
import { SAMPLE_PLAN } from "@shared/config/plan.sample";

function headerCount(table: HTMLElement): number {
  return within(table).getAllByRole("columnheader").length;
}

/* Test-only stateful fixture: real ToggleChip + real HistoryTable WITHOUT
   actions → the acceptance 6 → 4 count. Not a production component. */
function CompactHistoryFixture() {
  const [compact, setCompact] = useState(false);

  return (
    <div>
      <ToggleChip
        on={compact}
        onToggle={() => setCompact((value) => !value)}
        label="Compact"
      />
      <HistoryTable weeks={SAMPLE_PLAN.weeks} compact={compact} />
    </div>
  );
}

function historyTable(): HTMLElement {
  return screen.getByRole("region", { name: "Training history" });
}

afterEach(() => cleanup());

describe("pages ProgressPage — compact fixture (no actions, 6 → 4)", () => {
  it("starts at 6 columns with the chip off, flips to 4 on click", () => {
    render(<CompactHistoryFixture />);

    const chip = screen.getByRole("button", { name: "Compact" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    expect(headerCount(historyTable())).toBe(6);

    fireEvent.click(chip);

    expect(chip.getAttribute("aria-pressed")).toBe("true");
    const table = historyTable();
    expect(headerCount(table)).toBe(4);
    expect(within(table).getByRole("columnheader", { name: "Sets × Reps @ RPE" })).toBeTruthy();
    expect(within(table).queryByRole("columnheader", { name: "Rest" })).toBeNull();
  });
});

describe("pages ProgressPage — real page integration (7 → 4 → 7)", () => {
  it("owns the compact state: actions vanish in compact mode and return on exit", () => {
    render(<ProgressPage />);

    // Normal mode: 6 columns + Actions, Begin/Log buttons on every row.
    expect(headerCount(historyTable())).toBe(7);
    expect(screen.getAllByRole("button", { name: "Begin" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Log" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Compact" }));

    const table = historyTable();
    expect(headerCount(table)).toBe(4);
    expect(within(table).queryByRole("columnheader", { name: "Rest" })).toBeNull();
    expect(within(table).queryByRole("columnheader", { name: "Actions" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Begin" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Log" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Compact" }));

    expect(headerCount(historyTable())).toBe(7);
    expect(screen.getAllByRole("button", { name: "Begin" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Log" }).length).toBeGreaterThan(0);
  });
});
