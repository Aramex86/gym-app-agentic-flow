// @vitest-environment jsdom
/* features/plan-recompose — DOM interaction test (file-level environment
   directive keeps protected vite.config.ts untouched; same raw role/attr
   assertion style as ProgressPage.test.tsx — no jest-dom, globals off, so
   cleanup() and vi.unstubAllGlobals() are explicit in afterEach). The entity
   fetch is stubbed with vi.stubGlobal (plan A7: tests never hit the network);
   the wire/validation behavior itself is pinned by
   src/entities/training-plan/__tests__/api.test.ts. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { PlanRecompose } from "../index";
import { getActiveProfile } from "@entities/profile";
import { setComposerStatus, resetComposerStatus } from "@shared/config/composerStatus";
import { SAMPLE_PLAN } from "@shared/config/plan.sample";
import planRecomposeSource from "../ui/PlanRecompose.tsx?raw";
import type { TrainingPlan } from "@entities/training-plan";

/* Minimal VALID one-week plan (mirrors the entity-test fixture; passes
   validatePlan R1-R9 so the wire-through case reflects real behavior). */
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

function instructionBox(): HTMLTextAreaElement {
  return screen.getByRole("textbox", { name: "Re-compose instruction" }) as HTMLTextAreaElement;
}

function sendButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
}

function renderFeature() {
  render(<PlanRecompose plan={SAMPLE_PLAN} onPlanChange={vi.fn()} />);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  // Composer store is module-global (shell scenario card): tests must not
  // leak a status into the next test's Send button (plan §6, A3).
  resetComposerStatus();
});

describe("features plan-recompose — render (plan A1 naming)", () => {
  it("renders the labeled instruction box, placeholder and Send button", () => {
    renderFeature();
    expect(instructionBox().getAttribute("placeholder")).toBe(
      "e.g. Add a deload week and reduce volume",
    );
    expect(sendButton().textContent).toBe("Send");
  });

  it("Send is disabled while the trimmed instruction is empty (plan A4)", () => {
    renderFeature();
    expect(sendButton().disabled).toBe(true);

    fireEvent.change(instructionBox(), { target: { value: "   " } });
    expect(sendButton().disabled).toBe(true);

    fireEvent.change(instructionBox(), { target: { value: " add a deload week " } });
    expect(sendButton().disabled).toBe(false);
  });
});

describe("features plan-recompose — send behavior", () => {
  it("empty and whitespace-only input send NOTHING (plan A4)", () => {
    vi.stubGlobal("fetch", fetchMock);
    renderFeature();

    fireEvent.click(sendButton());
    fireEvent.change(instructionBox(), { target: { value: "   " } });
    fireEvent.click(sendButton());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("successful send issues ONE fetch with trimmed instruction and updates the plan", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));
    const onPlanChange = vi.fn();

    render(<PlanRecompose plan={SAMPLE_PLAN} onPlanChange={onPlanChange} />);
    fireEvent.change(instructionBox(), { target: { value: "   make it one week  " } });
    fireEvent.click(sendButton());

    await waitFor(() => expect(onPlanChange).toHaveBeenCalledTimes(1));
    expect(onPlanChange).toHaveBeenCalledWith(ONE_WEEK_PLAN);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/plan");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body));
    expect(body.instruction).toBe("make it one week");
    expect(body.plan.planId).toBe("sample-4w-upper-lower");
    expect(body.profile.id).toBe("profile-active");
    // Plan A5 — instruction text is kept for iteration after success.
    expect(instructionBox().value).toBe("   make it one week  ");
  });

  it("accepts the test-only profile override (plan props, A1 fixture)", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));
    const onPlanChange = vi.fn();
    const profile = { ...getActiveProfile(), id: "profile-test" };

    render(<PlanRecompose plan={SAMPLE_PLAN} onPlanChange={onPlanChange} profile={profile} />);
    fireEvent.change(instructionBox(), { target: { value: "add cardio" } });
    fireEvent.click(sendButton());

    await waitFor(() => expect(onPlanChange).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body));
    expect(body.profile.id).toBe("profile-test");
    expect(fetchMock.mock.calls[0]?.[1].method).toBe("POST");
  });

  it("pending: role=status indicator shows, Send + textarea disabled, second click adds NO call (plan A6)", async () => {
    vi.stubGlobal("fetch", fetchMock);
    // Deferred fetch: pending state persists across the second click.
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));
    const onPlanChange = vi.fn();

    render(<PlanRecompose plan={SAMPLE_PLAN} onPlanChange={onPlanChange} />);
    fireEvent.change(instructionBox(), { target: { value: "add cardio" } });
    fireEvent.click(sendButton());

    expect(screen.getByRole("status").textContent).toContain("Re-composing");
    expect(sendButton().disabled).toBe(true);
    expect(instructionBox().disabled).toBe(true);

    fireEvent.click(sendButton());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The deferred promise never resolves: the scenario stays pending until
    // unmount, which is exactly the frozen state under test (plan A6).
  });

  it("failure: fixed role=alert copy shows, plan NOT changed, retry works (plan A5/A6)", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    const onPlanChange = vi.fn();

    render(<PlanRecompose plan={SAMPLE_PLAN} onPlanChange={onPlanChange} />);
    fireEvent.change(instructionBox(), { target: { value: "add cardio" } });
    fireEvent.click(sendButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Could not re-compose the plan. Please try again.");
    expect(onPlanChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();

    // Error state re-enables Send; retry issues exactly one new call.
    expect(sendButton().disabled).toBe(false);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));
    fireEvent.click(sendButton());
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(onPlanChange).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("error text is cleared on the next send (plan A5)", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    const onPlanChange = vi.fn();

    render(<PlanRecompose plan={SAMPLE_PLAN} onPlanChange={onPlanChange} />);
    fireEvent.change(instructionBox(), { target: { value: "add cardio" } });
    fireEvent.click(sendButton());
    await screen.findByRole("alert");

    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("down again");
    });
    fireEvent.click(sendButton());

    // The failing retry keeps exactly one alert (the old one is replaced,
    // not duplicated — plan A5 fixed copy, never raw composer messages).
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getAllByRole("alert").length).toBe(1);
  });
});

describe("features plan-recompose — composer offline guard (plan A3)", () => {
  it("offline disables Send even with valid text, and a click sends NOTHING", () => {
    vi.stubGlobal("fetch", fetchMock);
    setComposerStatus("offline");

    renderFeature();
    fireEvent.change(instructionBox(), { target: { value: "add cardio" } });
    expect(sendButton().disabled).toBe(true);

    fireEvent.click(sendButton());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unknown and online keep Send enabled with valid text (no CTA gate)", () => {
    vi.stubGlobal("fetch", fetchMock);

    renderFeature();
    fireEvent.change(instructionBox(), { target: { value: "add cardio" } });
    expect(sendButton().disabled).toBe(false);

    cleanup();
    setComposerStatus("online");
    renderFeature();
    fireEvent.change(instructionBox(), { target: { value: "add cardio" } });
    expect(sendButton().disabled).toBe(false);
  });

  it("a LIVE change to offline disables Send without a remount (shared store)", () => {
    vi.stubGlobal("fetch", fetchMock);
    renderFeature();
    fireEvent.change(instructionBox(), { target: { value: "add cardio" } });
    expect(sendButton().disabled).toBe(false);

    // Healthcheck result lands while the plan screen is open; the store
    // notification is a React update → wrap in act (plan §6 wording).
    act(() => {
      setComposerStatus("offline");
    });
    expect(sendButton().disabled).toBe(true);

    // Recovery re-enables (the guard is the store, not a one-way latch).
    act(() => {
      setComposerStatus("online");
    });
    expect(sendButton().disabled).toBe(false);
  });
});

describe("features plan-recompose — source guards (plan acceptance 9/10)", () => {
  it("no hardcoded colors in the feature UI source (tokens only)", () => {
    expect(planRecomposeSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });

  it("no data fetching in the feature UI source (AGENTS.md data rule)", () => {
    expect(planRecomposeSource).not.toMatch(/fetch\s*\(|axios/i);
  });
});
