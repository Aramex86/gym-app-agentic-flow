// @vitest-environment jsdom
/* features/onboarding — DOM interaction tests. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Onboarding } from "../ui/Onboarding";
import { buildGeneratePlanRequest, TRAINING_GOAL_IDS } from "@entities/training-plan";
import type { TrainingPlan } from "@entities/training-plan";
import { getActiveProfile } from "@entities/profile";
import { resetComposerStatus, setComposerStatus } from "@shared/config/composerStatus";
import { resetActivePlan } from "@shared/config/activePlan";
import { GOAL_OPTIONS } from "../config/goals";
import { HARDWARE_IDS, HARDWARE_MAP } from "../config/hardware";
import onboardingSource from "../ui/Onboarding.tsx?raw";
import goalSelectSource from "../ui/GoalSelect.tsx?raw";
import hardwareMapSource from "../ui/HardwareMap.tsx?raw";
import payloadPreviewSource from "../ui/PayloadPreview.tsx?raw";

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

function generateButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Generate" }) as HTMLButtonElement;
}

function previewCodeText(): string {
  const region = screen.getByRole("region", { name: "Payload preview" });
  const code = region.querySelector("code");
  return code?.textContent ?? "";
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  resetComposerStatus();
  resetActivePlan();
});

describe("features onboarding B1", () => {
  it("Generate toggles disabled state based on selected goals", () => {
    render(<Onboarding onGenerated={vi.fn()} />);
    const generate = generateButton();
    const mobility = screen.getByRole("button", { name: "Mobility" });

    expect(generate.disabled).toBe(true);
    fireEvent.click(mobility);
    expect(generate.disabled).toBe(false);
    fireEvent.click(mobility);
    expect(generate.disabled).toBe(true);
  });
});

describe("features onboarding B2", () => {
  it("updates payload preview live and keeps canonical goal order", () => {
    const profile = getActiveProfile();
    render(<Onboarding onGenerated={vi.fn()} profile={profile} />);

    expect(previewCodeText()).toContain('"goals": []');

    fireEvent.click(screen.getByRole("button", { name: "Mobility" }));
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));

    const expected = JSON.stringify(
      buildGeneratePlanRequest(profile, ["strength", "mobility"], HARDWARE_IDS),
      null,
      2,
    );
    expect(previewCodeText()).toBe(expected);
  });
});

describe("features onboarding B3", () => {
  it("POSTs once, body equals preview JSON, shows pending state and ignores second click", async () => {
    vi.stubGlobal("fetch", fetchMock);
    let resolveResponse!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    }));
    const onGenerated = vi.fn();

    render(<Onboarding onGenerated={onGenerated} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fireEvent.click(generateButton());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/plan/generate");
    expect(screen.getByRole("status").textContent).toBe("Generating plan…");
    expect(generateButton().disabled).toBe(true);

    fireEvent.click(generateButton());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const sentBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body));
    const previewBody = JSON.parse(previewCodeText());
    expect(sentBody).toEqual(previewBody);

    resolveResponse(jsonResponse(ONE_WEEK_PLAN));
    await waitFor(() => expect(onGenerated).toHaveBeenCalledTimes(1));
  });
});

describe("features onboarding B4", () => {
  it("shows alert on HTTP 500, keeps selections, then clears alert on success", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    const onGenerated = vi.fn();

    render(<Onboarding onGenerated={onGenerated} />);
    const strength = screen.getByRole("button", { name: "Strength" });
    fireEvent.click(strength);
    fireEvent.click(generateButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Could not generate your plan. Please try again.");
    expect(onGenerated).not.toHaveBeenCalled();
    expect(strength.getAttribute("aria-pressed")).toBe("true");

    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));
    fireEvent.click(generateButton());
    await waitFor(() => expect(onGenerated).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows alert on network reject and keeps user on onboarding", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    const onGenerated = vi.fn();
    render(<Onboarding onGenerated={onGenerated} />);

    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fireEvent.click(generateButton());

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not generate your plan. Please try again.",
    );
    expect(onGenerated).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Onboarding" })).toBeTruthy();
  });
});

describe("features onboarding B5 + gate + hardware + config", () => {
  it("calls onGenerated once with a valid response", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));
    const onGenerated = vi.fn();

    render(<Onboarding onGenerated={onGenerated} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fireEvent.click(generateButton());

    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith(ONE_WEEK_PLAN));
    expect(onGenerated).toHaveBeenCalledTimes(1);
  });

  it("disables Generate when composer is offline even with selected goals", () => {
    render(<Onboarding onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    expect(generateButton().disabled).toBe(false);
    act(() => {
      setComposerStatus("offline");
    });
    expect(generateButton().disabled).toBe(true);
  });

  it("renders all hardware device names and tracked metrics", () => {
    render(<Onboarding onGenerated={vi.fn()} />);
    for (const source of HARDWARE_MAP) {
      expect(screen.getByText(source.device)).toBeTruthy();
      for (const metric of source.tracks) {
        expect(screen.getByText(metric)).toBeTruthy();
      }
    }
  });

  it("keeps GOAL_OPTIONS ids aligned with TRAINING_GOAL_IDS", () => {
    expect(GOAL_OPTIONS.map((option) => option.id)).toEqual([...TRAINING_GOAL_IDS]);
  });
});

describe("features onboarding — source guards", () => {
  it("ui sources contain no hardcoded colors, fetch/axios, or react-router", () => {
    const sources = [onboardingSource, goalSelectSource, hardwareMapSource, payloadPreviewSource];
    for (const source of sources) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|fetch\s*\(|axios|react-router/i);
    }
  });
});
