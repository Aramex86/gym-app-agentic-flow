// @vitest-environment jsdom
/* pages ProgressPage — recompose wiring DOM test (file-level environment
   directive keeps protected vite.config.ts untouched; same raw role/attr
   style as ProgressPage.test.tsx — no jest-dom, globals off, so cleanup()
   and vi.unstubAllGlobals() are explicit in afterEach). fetch is stubbed
   with vi.stubGlobal (plan A7: tests never hit the network); the wire and
   validation layers are pinned by the entity and feature suites. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ProgressPage } from "../ProgressPage";
import type { TrainingPlan } from "@entities/training-plan";

/* Minimal VALID one-week replacement plan (same fixture as the entity/feature
   suites; passes validatePlan R1-R9 so the page rerenders on it for real). */
const ONE_WEEK_PLAN: TrainingPlan = {
  schemaVersion: "0.1",
  planId: "one-week-fullbody",
  title: "One Week Full Body",
  goal: "General fitness",
  level: "beginner",
  disclaimer: "Not medical advice.",
  weeks: [
    {
      week: 1,
      focus: "Full body",
      days: [
        {
          day: 1,
          split: "Full body",
          exercises: [
            { id: "full-body-squat", name: "Back Squat", sets: 3, reps: 8, rpe: 6, restSec: 90 },
          ],
        },
      ],
    },
  ],
};

const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>();

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  } as unknown as Response;
}

function historyRows(): HTMLElement[] {
  return screen.getAllByTestId("history-row");
}

function instructionBox(): HTMLTextAreaElement {
  return screen.getByRole("textbox", { name: "Re-compose instruction" }) as HTMLTextAreaElement;
}

function sendButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("pages ProgressPage — prompt box placement (plan A2)", () => {
  it("renders the labeled textarea after the heading and disclaimer, before the history table", () => {
    const { container } = render(<ProgressPage />);

    const textbox = instructionBox();
    const heading = screen.getByRole("heading", { name: "Progress" });
    const note = screen.getByRole("note");
    const table = screen.getByRole("region", { name: "Training history" });

    expect(
      heading.compareDocumentPosition(textbox) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      note.compareDocumentPosition(textbox) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      textbox.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // ADR-0001 D4 stays intact: the disclaimer note precedes the prompt box.
    expect(
      note.compareDocumentPosition(container.querySelector("table") as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("pages ProgressPage — wire-through (plan acceptance 2/7)", () => {
  it("send POSTs profile + current plan + instruction and the returned plan re-renders metrics + table", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));
    render(<ProgressPage />);

    expect(historyRows().length).toBe(40);

    fireEvent.change(instructionBox(), {
      target: { value: "make it a one-week full-body plan" },
    });
    fireEvent.click(sendButton());

    await waitFor(() => expect(historyRows().length).toBe(1));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/plan");
    expect(fetchMock.mock.calls[0]?.[1].method).toBe("POST");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body));
    expect(body.instruction).toBe("make it a one-week full-body plan");
    expect(body.plan.planId).toBe("sample-4w-upper-lower");
    expect(body.profile.id).toBe("profile-active");

    // Metrics derive from the page state, so they update with the table.
    expect(screen.getByText("Weeks").nextElementSibling?.textContent).toBe("1");
    expect(screen.getByText("Total sets").nextElementSibling?.textContent).toBe("3");
  });
});

describe("pages ProgressPage — composer failure (plan acceptance 6)", () => {
  it("HTTP 500 shows the fixed alert copy and keeps the original 40 rows", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    render(<ProgressPage />);

    fireEvent.change(instructionBox(), { target: { value: "add cardio" } });
    fireEvent.click(sendButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Could not re-compose the plan. Please try again.");
    expect(historyRows().length).toBe(40);
    expect(screen.getByText("Weeks").nextElementSibling?.textContent).toBe("4");
  });
});
