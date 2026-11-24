// @vitest-environment jsdom
/* features/onboarding — DOM interaction tests. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Onboarding } from "../ui/Onboarding";
import { buildGeneratePlanRequest, TRAINING_GOAL_IDS } from "@entities/training-plan";
import type { TrainingPlan } from "@entities/training-plan";
import {
  DAILY_ACTIVITY_IDS,
  DEFAULT_LIFESTYLE_PROFILE,
  DEFAULT_ORTHOPEDIC_PROFILE,
  ORTHOPEDIC_LIMITATION_IDS,
  SLEEP_DURATION_IDS,
  STRESS_LEVEL_IDS,
  getActiveProfile,
} from "@entities/profile";
import { resetComposerStatus, setComposerStatus } from "@shared/config/composerStatus";
import { resetActivePlan } from "@shared/config/activePlan";
import { GOAL_OPTIONS } from "../config/goals";
import { HARDWARE_IDS, HARDWARE_MAP } from "../config/hardware";
import {
  DAILY_ACTIVITY_OPTIONS,
  SLEEP_DURATION_OPTIONS,
  STRESS_LEVEL_OPTIONS,
} from "../config/lifestyle";
import { CAUTION_MAX_LENGTH, CAUTION_PLACEHOLDER, ORTHOPEDIC_LIMITATION_OPTIONS } from "../config/limitations";
import onboardingSource from "../ui/Onboarding.tsx?raw";
import goalSelectSource from "../ui/GoalSelect.tsx?raw";
import hardwareMapSource from "../ui/HardwareMap.tsx?raw";
import lifestyleRecoverySource from "../ui/LifestyleRecovery.tsx?raw";
import lifestyleConfigSource from "../config/lifestyle.ts?raw";
import orthopedicLimitationsSource from "../ui/OrthopedicLimitations.tsx?raw";
import limitationsConfigSource from "../config/limitations.ts?raw";
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
    const sources = [
      onboardingSource,
      goalSelectSource,
      hardwareMapSource,
      lifestyleRecoverySource,
      lifestyleConfigSource,
      orthopedicLimitationsSource,
      limitationsConfigSource,
      payloadPreviewSource,
    ];
    for (const source of sources) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|fetch\s*\(|axios|react-router/i);
    }
  });

  it("onboarding lifestyle and orthopedic sources leak no data off the device (payload is the only egress)", () => {
    const sources = [
      onboardingSource,
      lifestyleRecoverySource,
      lifestyleConfigSource,
      orthopedicLimitationsSource,
      limitationsConfigSource,
    ];
    for (const source of sources) {
      expect(source).not.toMatch(/localStorage|sessionStorage|sendBeacon/i);
    }
  });
});

describe("features onboarding — lifestyle & recovery", () => {
  function group(name: string): HTMLElement {
    return screen.getByRole("group", { name });
  }

  it("renders the heading, three named groups and the skippable hint", () => {
    render(<Onboarding onGenerated={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Lifestyle & recovery" })).toBeTruthy();
    expect(group("Sleep duration")).toBeTruthy();
    expect(group("Daily activity")).toBeTruthy();
    expect(group("Stress level")).toBeTruthy();
    expect(screen.getByText("Skip any field — moderate defaults are already applied.")).toBeTruthy();
  });

  it("opens on moderate defaults with exactly one pressed chip per group", () => {
    render(<Onboarding onGenerated={vi.fn()} />);

    // WHY: "Moderate" exists in two groups — always scope with within(group).
    expect(
      within(group("Sleep duration")).getByRole("button", { name: "7-8 h" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      within(group("Daily activity")).getByRole("button", { name: "Moderate" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      within(group("Stress level")).getByRole("button", { name: "Moderate" }).getAttribute("aria-pressed"),
    ).toBe("true");

    for (const name of ["Sleep duration", "Daily activity", "Stress level"]) {
      expect(
        within(group(name)).getAllByRole("button").filter((chip) => chip.getAttribute("aria-pressed") === "true")
          .length,
      ).toBe(1);
    }
  });

  it("payload preview contains the moderate lifestyle defaults before any click", () => {
    render(<Onboarding onGenerated={vi.fn()} />);

    const preview = JSON.parse(previewCodeText()) as { profile: { lifestyle: unknown } };
    expect(preview.profile.lifestyle).toEqual({
      sleepDuration: "7-8",
      dailyActivity: "moderate",
      stressLevel: "moderate",
    });
  });

  it("changing sleep/activity/stress updates the preview wire ids", () => {
    render(<Onboarding onGenerated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "< 6 h" }));
    fireEvent.click(within(group("Daily activity")).getByRole("button", { name: "High" }));
    fireEvent.click(within(group("Stress level")).getByRole("button", { name: "Low" }));

    const preview = JSON.parse(previewCodeText()) as {
      profile: { lifestyle: { sleepDuration: string; dailyActivity: string; stressLevel: string } };
    };
    expect(preview.profile.lifestyle).toEqual({
      sleepDuration: "under-6",
      dailyActivity: "high",
      stressLevel: "low",
    });
  });

  it("clicking an already-selected chip keeps it pressed and leaves the preview unchanged", () => {
    render(<Onboarding onGenerated={vi.fn()} />);
    const before = previewCodeText();

    const sleepChip = within(group("Sleep duration")).getByRole("button", { name: "7-8 h" });
    fireEvent.click(sleepChip);
    expect(sleepChip.getAttribute("aria-pressed")).toBe("true");
    expect(previewCodeText()).toBe(before);
  });

  it("generate with only a goal selected POSTs the preview body including default lifestyle", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));
    const onGenerated = vi.fn();

    render(<Onboarding onGenerated={onGenerated} />);
    fireEvent.click(screen.getByRole("button", { name: "Endurance" }));
    fireEvent.click(generateButton());

    await waitFor(() => expect(onGenerated).toHaveBeenCalledTimes(1));

    const sentBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body));
    const previewBody = JSON.parse(previewCodeText());
    expect(sentBody).toEqual(previewBody);
    expect(sentBody.profile.lifestyle).toEqual(DEFAULT_LIFESTYLE_PROFILE);
  });

  it("lifestyle chip clicks are ignored while a generate is pending", () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));

    render(<Onboarding onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fireEvent.click(generateButton());
    expect(generateButton().disabled).toBe(true);

    fireEvent.click(within(group("Sleep duration")).getByRole("button", { name: "8+ h" }));
    fireEvent.click(within(group("Daily activity")).getByRole("button", { name: "High" }));

    expect(
      within(group("Sleep duration")).getByRole("button", { name: "7-8 h" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      within(group("Sleep duration")).getByRole("button", { name: "8+ h" }).getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      within(group("Daily activity")).getByRole("button", { name: "Moderate" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("keeps lifestyle option ids aligned with the canonical entity tuples", () => {
    expect(SLEEP_DURATION_OPTIONS.map((option) => option.id)).toEqual([...SLEEP_DURATION_IDS]);
    expect(DAILY_ACTIVITY_OPTIONS.map((option) => option.id)).toEqual([...DAILY_ACTIVITY_IDS]);
    expect(STRESS_LEVEL_OPTIONS.map((option) => option.id)).toEqual([...STRESS_LEVEL_IDS]);
  });
});

describe("features onboarding — orthopedic limitations", () => {
  function limitationGroup(): HTMLElement {
    return screen.getByRole("group", { name: "Joints / movements to protect" });
  }

  function cautionTextarea(): HTMLTextAreaElement {
    return screen.getByRole("textbox", { name: "Caution note" }) as HTMLTextAreaElement;
  }

  function pressedChipNames(): string[] {
    return within(limitationGroup())
      .queryAllByRole("button")
      .filter((chip) => chip.getAttribute("aria-pressed") === "true")
      .map((chip) => chip.textContent ?? "");
  }

  it("renders heading, optional hint, the named chip group, five unpressed chips and an empty textarea", () => {
    render(<Onboarding onGenerated={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Orthopedic limitations" })).toBeTruthy();
    expect(screen.getByText("Optional — skip any field you don't need.")).toBeTruthy();
    expect(limitationGroup()).toBeTruthy();
    for (const option of ORTHOPEDIC_LIMITATION_OPTIONS) {
      const chip = within(limitationGroup()).getByRole("button", { name: option.label });
      expect(chip.getAttribute("aria-pressed")).toBe("false");
    }
    expect(pressedChipNames()).toEqual([]);
    expect(cautionTextarea().value).toBe("");
  });

  it("empty defaults appear in the preview (orthopedicLimitations: [], caution: \"\")", () => {
    render(<Onboarding onGenerated={vi.fn()} />);

    const preview = JSON.parse(previewCodeText()) as {
      profile: { orthopedicLimitations: unknown[]; caution: string };
      caution: string;
    };
    expect(preview.profile.orthopedicLimitations).toEqual([]);
    expect(preview.profile.caution).toBe("");
    expect(preview.caution).toBe("");
  });

  it("toggles write canonical ids into the structured profile field and can be removed again", () => {
    render(<Onboarding onGenerated={vi.fn()} />);

    // Click order is lower-back then knee — the profile field must be canonical.
    fireEvent.click(within(limitationGroup()).getByRole("button", { name: "Lower back" }));
    fireEvent.click(within(limitationGroup()).getByRole("button", { name: "Knee" }));

    const preview = JSON.parse(previewCodeText()) as {
      profile: { orthopedicLimitations: string[] };
    };
    expect(preview.profile.orthopedicLimitations).toEqual(["knee", "lower-back"]);
    // WHY: pressedChipNames reads DOM order (config order), not click order.
    expect(pressedChipNames()).toEqual(["Knee", "Lower back"]);

    fireEvent.click(within(limitationGroup()).getByRole("button", { name: "Knee" }));
    expect(pressedChipNames()).toEqual(["Lower back"]);
    expect((JSON.parse(previewCodeText()) as { profile: { orthopedicLimitations: string[] } })
      .profile.orthopedicLimitations).toEqual(["lower-back"]);
  });

  it("copies the caution text verbatim (lead/trailing spaces, no trim) into both wire copies", () => {
    render(<Onboarding onGenerated={vi.fn()} />);

    const typed = "  keep leading and trailing spaces  ";
    fireEvent.change(cautionTextarea(), { target: { value: typed } });

    const preview = JSON.parse(previewCodeText()) as {
      caution: string;
      profile: { caution: string };
    };
    expect(preview.caution).toBe(typed);
    expect(preview.profile.caution).toBe(typed);
  });

  it("caps input longer than the max and shows the 280/280 counter", () => {
    render(<Onboarding onGenerated={vi.fn()} />);

    fireEvent.change(cautionTextarea(), {
      target: { value: CAUTION_PLACEHOLDER + " ".repeat(CAUTION_MAX_LENGTH) },
    });

    expect(cautionTextarea().value.length).toBe(CAUTION_MAX_LENGTH);
    expect(cautionTextarea().value).toBe(
      (CAUTION_PLACEHOLDER + " ".repeat(CAUTION_MAX_LENGTH)).slice(0, CAUTION_MAX_LENGTH),
    );
    expect(screen.getByText(`${CAUTION_MAX_LENGTH}/${CAUTION_MAX_LENGTH}`)).toBeTruthy();
  });

  it("Generate is not blocked by empty orthopedic inputs (A5: optional step)", () => {
    render(<Onboarding onGenerated={vi.fn()} />);

    expect(generateButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Fat loss" }));
    expect(generateButton().disabled).toBe(false);
  });

  it("generate POSTs the preview body including caution and the limitation ids", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));
    const onGenerated = vi.fn();

    render(<Onboarding onGenerated={onGenerated} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fireEvent.click(within(limitationGroup()).getByRole("button", { name: "Wrist" }));
    fireEvent.click(within(limitationGroup()).getByRole("button", { name: "Custom" }));
    fireEvent.change(cautionTextarea(), { target: { value: "no loaded wrist extension" } });
    fireEvent.click(generateButton());

    await waitFor(() => expect(onGenerated).toHaveBeenCalledTimes(1));

    const sentBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body));
    const previewBody = JSON.parse(previewCodeText());
    expect(sentBody).toEqual(previewBody);
    expect(sentBody.caution).toBe("no loaded wrist extension");
    expect(sentBody.profile.caution).toBe("no loaded wrist extension");
    expect(sentBody.profile.orthopedicLimitations).toEqual(
      ORTHOPEDIC_LIMITATION_IDS.filter((id) =>
        new Set(["wrist", "custom"]).has(id),
      ),
    );
  });

  it("chip clicks are ignored and the textarea is frozen while generate is pending", () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));

    render(<Onboarding onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fireEvent.click(within(limitationGroup()).getByRole("button", { name: "Shoulder" }));
    fireEvent.change(cautionTextarea(), { target: { value: "frozen text" } });
    fireEvent.click(generateButton());
    expect(generateButton().disabled).toBe(true);

    fireEvent.click(within(limitationGroup()).getByRole("button", { name: "Wrist" }));
    expect(
      within(limitationGroup()).getByRole("button", { name: "Shoulder" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      within(limitationGroup()).getByRole("button", { name: "Wrist" }).getAttribute("aria-pressed"),
    ).toBe("false");

    expect(cautionTextarea().disabled).toBe(true);
    expect(cautionTextarea().value).toBe("frozen text");
    expect(screen.getByText(`${"frozen text".length}/${CAUTION_MAX_LENGTH}`)).toBeTruthy();
  });

  it("profile override seeds chips, textarea and preview (re-entry/edit behavior)", () => {
    const profile = {
      ...getActiveProfile(),
      orthopedicLimitations: ["shoulder"] as const,
      caution: "No overhead press",
    };
    render(<Onboarding onGenerated={vi.fn()} profile={profile} />);

    expect(
      within(limitationGroup()).getByRole("button", { name: "Shoulder" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(pressedChipNames()).toEqual(["Shoulder"]);
    expect(cautionTextarea().value).toBe("No overhead press");
    expect(screen.getByText(`${"No overhead press".length}/${CAUTION_MAX_LENGTH}`)).toBeTruthy();

    // Editing adds another tag and the preview follows.
    fireEvent.click(within(limitationGroup()).getByRole("button", { name: "Knee" }));
    const preview = JSON.parse(previewCodeText()) as {
      profile: { orthopedicLimitations: string[]; caution: string };
      caution: string;
    };
    expect(preview.profile.orthopedicLimitations).toEqual(["knee", "shoulder"]);
    expect(preview.caution).toBe("No overhead press");
  });

  it("keeps limitation option ids aligned with the canonical entity tuple", () => {
    expect(ORTHOPEDIC_LIMITATION_OPTIONS.map((option) => option.id)).toEqual([
      ...ORTHOPEDIC_LIMITATION_IDS,
    ]);
  });

  it("DEFAULT_ORTHOPEDIC_PROFILE is the skippable empty shape", () => {
    expect(DEFAULT_ORTHOPEDIC_PROFILE.orthopedicLimitations).toEqual([]);
    expect(DEFAULT_ORTHOPEDIC_PROFILE.caution).toBe("");
  });
});
