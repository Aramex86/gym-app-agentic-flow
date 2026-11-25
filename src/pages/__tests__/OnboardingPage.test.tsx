// @vitest-environment jsdom
/* pages OnboardingPage — routing + onboarding flow tests. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OnboardingPage } from "../OnboardingPage";
import { getTrainingPlan } from "@entities/training-plan";
import { resetActiveProfile } from "@entities/profile";
import { resetComposerStatus } from "@shared/config/composerStatus";
import { resetActivePlan } from "@shared/config/activePlan";
import type { TrainingPlan } from "@entities/training-plan";
import onboardingPageSource from "../OnboardingPage.tsx?raw";

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

/** Completes the required foundation fields (Age 30, Height 178, Weight 75,
    tier Intermediate) — the CTA gate before every Generate click. */
function fillRequiredProfile(): void {
  fireEvent.change(screen.getByRole("spinbutton", { name: "Age" }), { target: { value: "30" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Height" }), { target: { value: "178" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Weight" }), { target: { value: "75" } });
  fireEvent.click(
    within(screen.getByRole("group", { name: "Experience tier" })).getByRole("button", {
      name: "Intermediate",
    }),
  );
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/progress" element={<p>My Plan screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  resetComposerStatus();
  resetActivePlan();
  // WHY: the profile store is module-global; generating tests must leave the
  // first-run fixture behind (plan A11).
  resetActiveProfile();
});

describe("pages OnboardingPage", () => {
  it("renders onboarding heading and disabled Generate button initially", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Onboarding" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Generate" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("Generate stays disabled with a goal until the required biometrics + tier complete, then navigates and stores the plan", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));

    renderPage();
    const generate = screen.getByRole("button", { name: "Generate" }) as HTMLButtonElement;

    // Goal alone does not pass the gate.
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    expect(generate.disabled).toBe(true);

    fillRequiredProfile();
    expect(generate.disabled).toBe(false);
    fireEvent.click(generate);

    await screen.findByText("My Plan screen");
    expect(getTrainingPlan()).toBe(ONE_WEEK_PLAN);
  });

  it("navigates to /progress on success and stores the generated plan", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fillRequiredProfile();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await screen.findByText("My Plan screen");
    expect(getTrainingPlan()).toBe(ONE_WEEK_PLAN);
  });

  it("shows alert and stays on onboarding when generate fails", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fillRequiredProfile();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "Could not generate your plan. Please try again.",
      );
    });
    expect(screen.getByRole("heading", { name: "Onboarding" })).toBeTruthy();
    expect(screen.queryByText("My Plan screen")).toBeNull();
  });
});

describe("pages OnboardingPage — source guards", () => {
  it("source has no hardcoded colors or data fetching calls", () => {
    expect(onboardingPageSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|fetch\s*\(|axios/i);
  });
});
