/* shared/ui HistoryTable — node-safe SSR test (repo has no jsdom/testing-library,
   same react-dom/server pattern as AppShell.test.tsx / HomePage.test.tsx).
   renderToString is synchronous, so the `actions` callback runs during render —
   call-recording fixtures assert data plumbing without click simulation.
   Row counts are DERIVED from SAMPLE_PLAN (only the exact 40 is an acceptance
   pin from plan-schema §6, asserted alongside the derived value). */

import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { HistoryTable } from "../HistoryTable";
import { Button } from "../atoms/Button";
import historyTableSource from "../HistoryTable.tsx?raw";
import type { HistoryRowInfo } from "../HistoryTable";
import { SAMPLE_PLAN } from "@shared/config/plan.sample";
import type { PlanWeek } from "@shared/config/plan.schema";

function render(element: ReactElement): string {
  // react-dom/server emits <!-- --> between adjacent text nodes — strip them
  // so cell contents parse as plain text.
  return renderToString(element).replaceAll("<!-- -->", "");
}

const allWeeks = SAMPLE_PLAN.weeks;
const totalRows = allWeeks
  .flatMap((w) => w.days)
  .flatMap((d) => d.exercises).length;

/* ProgressPage source is checked for token-only styling too. FSAA boundaries
   forbid a shared→pages module import (?raw), so the source text is inlined
   at build time via import.meta.glob (no runtime fs, no module dependency). */
const pagesRaw = import.meta.glob<{ default: string }>("/src/pages/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
});
const progressPageSource = pagesRaw["/src/pages/ProgressPage.tsx"];

/* Small uneven fixture (1 row in week 1, 2 rows in week 2). */
const unevenWeeks: PlanWeek[] = [
  {
    week: 1,
    focus: "one row only",
    days: [
      {
        day: 1,
        split: "Upper",
        exercises: [{ id: "x1", name: "X One", sets: 1, reps: 1, rpe: 5, restSec: 15 }],
      },
    ],
  },
  {
    week: 2,
    focus: "two rows",
    days: [
      {
        day: 1,
        split: "Lower",
        exercises: [
          { id: "x2", name: "X Two", sets: 2, reps: 2, rpe: 6, restSec: 30 },
          { id: "x3", name: "X Three", sets: 3, reps: 3, rpe: 7, restSec: 45 },
        ],
      },
    ],
  },
];

describe("shared/ui HistoryTable — no actions prop", () => {
  it("renders SAMPLE_PLAN rows (derived count, plan pin 40)", () => {
    const html = render(<HistoryTable weeks={allWeeks} />);
    const rowCount = html.match(/data-testid="history-row"/g)?.length ?? 0;
    expect(rowCount).toBe(totalRows);
    expect(rowCount).toBe(40);
  });

  it("stays the unchanged 6-column table — no Actions header", () => {
    const html = render(<HistoryTable weeks={allWeeks} />);
    for (const header of ["Week", "Split", "Exercise", "Sets × Reps", "RPE", "Rest"]) {
      expect(html).toContain(`>${header}<`);
    }
    expect(html).not.toContain(">Actions<");
  });

  it("empty state keeps colSpan of 6", () => {
    const html = render(<HistoryTable weeks={[]} />);
    // React 19 SSR keeps the camelCase prop name in the attribute output.
    expect(html).toContain('colSpan="6"');
    expect(html).toContain("No history yet");
  });
});

describe("shared/ui HistoryTable — with actions", () => {
  const noop = (): null => null;

  it("renders an Actions header exactly once as the 7th column", () => {
    const html = render(
      <HistoryTable weeks={allWeeks} actions={noop} />,
    );
    expect(html.match(/>Actions</g)?.length).toBe(1);
    expect(html).toContain(">Rest<");
  });

  it("renders one actions cell per row (2 stub buttons each → 80 for 40 rows)", () => {
    const html = render(
      <HistoryTable
        weeks={allWeeks}
        actions={() => (
          <>
            <button type="button">a</button>
            <button type="button">b</button>
          </>
        )}
      />,
    );
    const buttons = html.match(/<button/g)?.length ?? 0;
    // Two buttons per row — derived, plus the acceptance pin for SAMPLE_PLAN.
    expect(buttons).toBe(totalRows * 2);
    expect(buttons).toBe(80);
  });

  it("empty state with actions widens colSpan to 7", () => {
    const html = render(<HistoryTable weeks={[]} actions={noop} />);
    expect(html).toContain('colSpan="7"');
    expect(html).not.toContain('colSpan="6"');
  });

  it("plumbs flattened row data to the actions callback in order", () => {
    const seen: HistoryRowInfo[] = [];
    render(
      <HistoryTable
        weeks={allWeeks}
        actions={(row) => {
          seen.push(row);
          return null;
        }}
      />,
    );
    expect(seen.length).toBe(40);
    seen.forEach((row) => {
      expect(typeof row.week).toBe("number");
      expect(typeof row.split).toBe("string");
      // PlanExercise shape (plan.schema): id/name/sets/reps/rpe/restSec.
      expect(typeof row.exercise.id).toBe("string");
      expect(typeof row.exercise.name).toBe("string");
      expect(typeof row.exercise.sets).toBe("number");
      expect(typeof row.exercise.reps).toBe("number");
      expect(typeof row.exercise.rpe).toBe("number");
      expect(typeof row.exercise.restSec).toBe("number");
    });
    // Flatten order preserved: first row is the first exercise of the plan.
    expect(seen[0].exercise).toEqual(allWeeks[0].days[0].exercises[0]);
    expect(seen[seen.length - 1].exercise).toEqual(
      allWeeks[allWeeks.length - 1].days.at(-1)?.exercises.at(-1),
    );
  });

  it("plumbs correct week/split/exercise for an uneven fixture", () => {
    const seen: HistoryRowInfo[] = [];
    render(
      <HistoryTable
        weeks={unevenWeeks}
        actions={(row) => {
          seen.push(row);
          return null;
        }}
      />,
    );
    expect(seen.map((r) => [r.week, r.split, r.exercise.id])).toEqual([
      [1, "Upper", "x1"],
      [2, "Lower", "x2"],
      [2, "Lower", "x3"],
    ]);
  });
});

describe("shared/ui HistoryTable — page-fixture buttons (Begin/Log)", () => {
  /* Renders the fixture's actions payload with the real Button atom —
     no style copies; the atom is the single source of truth (plan R2). */

  const unevenRows = unevenWeeks
    .flatMap((w) => w.days)
    .flatMap((d) => d.exercises).length;

  function renderWithButtons(): string {
    return render(
      <HistoryTable
        weeks={unevenWeeks}
        actions={(row: HistoryRowInfo) => (
          <span style={{ display: "flex", gap: "var(--sp-xs)" }}>
            <Button variant="primary">Begin</Button>
            <Button variant="secondary">Log</Button>
            <span data-testid="row-id">{row.exercise.id}</span>
          </span>
        )}
      />,
    );
  }

  it("renders accessible Begin/Log labels", () => {
    const html = renderWithButtons();
    expect(html).toContain(">Begin<");
    expect(html).toContain(">Log<");
    expect(html.match(/<button/g)?.length).toBe(unevenRows * 2);
  });

  it("primary button uses the accent-volt token in rendered HTML", () => {
    expect(renderWithButtons()).toContain("var(--accent-volt)");
    expect(renderWithButtons()).toContain("var(--surface-lifted)");
  });
});

describe("shared/ui HistoryTable — tokens only", () => {
  it("no hardcoded colors in HistoryTable or ProgressPage source", () => {
    expect(historyTableSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
    expect(progressPageSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching in either source (AGENTS.md data rule)", () => {
    // Call sites only — the word "fetching" in comments is not a call.
    expect(historyTableSource).not.toMatch(/fetch\s*\(|axios/i);
    expect(progressPageSource).not.toMatch(/fetch\s*\(|axios/i);
  });
});

describe("shared/ui HistoryTable — compact", () => {
  /* Compact is read-only: 4 combined columns, actions suppressed entirely
     (no Actions header, no callback invocation — plan §3). */

  it("renders exactly four headers — Week, Split, Exercise, Sets × Reps @ RPE", () => {
    const html = render(<HistoryTable compact weeks={allWeeks} />);
    expect(html.match(/<th\b/g)?.length).toBe(4);
    for (const header of ["Week", "Split", "Exercise", "Sets × Reps @ RPE"]) {
      expect(html).toContain(`>${header}<`);
    }
    // Standalone metric headers disappear in compact mode.
    expect(html).not.toContain(">RPE<");
    expect(html).not.toContain(">Sets × Reps<");
    expect(html).not.toContain(">Rest<");
    expect(html).not.toContain(">Actions<");
  });

  it("emits one combined metric cell per row in the compact metric style", () => {
    const html = render(<HistoryTable compact weeks={unevenWeeks} />);
    expect(html).toEqual(expect.stringContaining("2 × 2 @ 6"));
    expect(html).toContain("3 × 3 @ 7");
    expect(html).toContain("var(--font-metric)");
    expect(html).toContain("var(--sp-xs) var(--sp-sm)");
  });

  it("does not invoke the actions callback nor render its output when set", () => {
    let calls = 0;
    const html = render(
      <HistoryTable
        compact
        weeks={unevenWeeks}
        actions={() => {
          calls += 1;
          return (
            <>
              <button type="button">a</button>
              <button type="button">b</button>
            </>
          );
        }}
      />,
    );
    expect(calls).toBe(0);
    expect(html).not.toContain(">Actions<");
    expect(html).not.toContain("<button");
  });

  it("empty compact state narrows colSpan to 4", () => {
    const html = render(<HistoryTable compact weeks={[]} />);
    expect(html).toContain('colSpan="4"');
    expect(html).toContain("No history yet");
  });

  it("keeps row count and caption behavior identical to normal mode", () => {
    const html = render(<HistoryTable compact weeks={allWeeks} />);
    const rowCount = html.match(/data-testid="history-row"/g)?.length ?? 0;
    expect(rowCount).toBe(totalRows);
    expect(html).toContain("Training history");
  });
});

describe("shared/ui HistoryTable — scrollbar styling", () => {
  /* Pins the style-scrollbar contract: thin scrollbar on the scroll
     container plus the WebKit fallback, token-colored (no inline styles —
     pseudo-selectors live in the scoped <style> block). jsdom cannot render
     scrollbars, so the assertion is on the emitted CSS string. */
  it("emits a <style> with scrollbar-width: thin and a webkit fallback", () => {
    const html = render(<HistoryTable weeks={allWeeks} />);
    expect(html).toContain("scrollbar-width: thin");
    expect(html).toContain("scrollbar-color: var(--surface-bright) transparent");
    expect(html).toContain(".history-table::-webkit-scrollbar-thumb");
    // Thumb + hover stay token-only.
    expect(html).toContain(".history-table::-webkit-scrollbar-thumb:hover");
  });
});
