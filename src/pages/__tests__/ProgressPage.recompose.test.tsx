// @vitest-environment jsdom
/* pages ProgressPage — recompose wiring DOM test (file-level environment
   directive keeps protected vite.config.ts untouched; same raw role/attr
   style as ProgressPage.test.tsx — no jest-dom, globals off, so cleanup()
   and vi.unstubAllGlobals() are explicit in afterEach). fetch is stubbed
   with vi.stubGlobal via a URL-AWARE implementation (plan A7: the page now
   auto-loads the AI review insight on mount, so single-shot mocks would be
   consumed by it; /api/progress/insight gets its own valid payload and the
   call-count assertions filter to /api/plan). Alert queries are scoped with
   `within` to the re-compose wrapper so the insight card can never collide
   with the composer error. The wire and validation layers are pinned by the
   entity and feature suites. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within, fireEvent, cleanup, waitFor } from "@testing-library/react";
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

/* Valid gate payload for the mount-time insight request (docs/contracts/
   progress-insight.md shape; periodId matches the sample's derived period). */
const VALID_INSIGHT = {
  periodId: "last-4-weeks",
  model: "kimi-k3.1",
  insight: "Bench progressed twice; squat PR at 122.5 kg e1RM.",
};

const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>();

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  } as unknown as Response;
}

/* URL-aware stub: the mount-time insight request cannot consume the
   one-week-plan response (plan A7). `planOutcome` is what POST /api/plan
   returns for the test at hand. */
function stubFetch(planOutcome: { payload: unknown; status: number } = {
  payload: ONE_WEEK_PLAN,
  status: 200,
}): void {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation((input: string) => {
    if (input === "/api/progress/insight") {
      return Promise.resolve(jsonResponse(VALID_INSIGHT));
    }
    if (input === "/api/plan") {
      return Promise.resolve(jsonResponse(planOutcome.payload, planOutcome.status));
    }
    // Unknown URLs (e.g. a composer healthcheck) count as healthy 2xx.
    return Promise.resolve(jsonResponse({}, 200));
  });
}

function urlCalls(url: string): Array<readonly [string, RequestInit]> {
  return fetchMock.mock.calls.filter(([callUrl]) => callUrl === url);
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

function recomposeWrapper(): HTMLElement {
  return sendButton().closest("div") as HTMLElement;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("pages ProgressPage — prompt box placement (plan A2)", () => {
  it("renders the labeled textarea after the heading and disclaimer, before the history table", () => {
    stubFetch(); // mount-time insight request must not hit the network (A7)
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
    stubFetch();
    render(<ProgressPage />);

    expect(historyRows().length).toBe(40);

    fireEvent.change(instructionBox(), {
      target: { value: "make it a one-week full-body plan" },
    });
    fireEvent.click(sendButton());

    await waitFor(() => expect(historyRows().length).toBe(1));

    // Plan A7: the mount-time insight request is filtered away — ONLY the
    // composer call counts here.
    expect(urlCalls("/api/plan").length).toBe(1);
    const planCall = urlCalls("/api/plan")[0]!;
    expect(planCall[0]).toBe("/api/plan");
    expect(planCall[1].method).toBe("POST");
    const body = JSON.parse(String(planCall[1].body));
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
    stubFetch({ payload: {}, status: 500 });
    render(<ProgressPage />);

    fireEvent.change(instructionBox(), { target: { value: "add cardio" } });
    fireEvent.click(sendButton());

    // Scoped `within` the re-compose wrapper (plan A7): the AI review card's
    // own alert lives outside this subtree and cannot collide.
    const alert = await within(recomposeWrapper()).findByRole("alert");
    expect(alert.textContent).toBe("Could not re-compose the plan. Please try again.");
    expect(historyRows().length).toBe(40);
    expect(screen.getByText("Weeks").nextElementSibling?.textContent).toBe("4");
  });
});
