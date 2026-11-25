// @vitest-environment jsdom
/* features/onboarding — DOM interaction tests. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Onboarding } from "../ui/Onboarding";
import { buildGeneratePlanRequest, TRAINING_GOAL_IDS } from "@entities/training-plan";
import type { TrainingPlan } from "@entities/training-plan";
import {
  BIOMETRIC_FIELDS,
  DEFAULT_LIFESTYLE_PROFILE,
  DEFAULT_ORTHOPEDIC_PROFILE,
  EXPERIENCE_TIER_IDS,
  ORTHOPEDIC_LIMITATION_IDS,
  SLEEP_DURATION_IDS,
  STRESS_LEVEL_IDS,
  DAILY_ACTIVITY_IDS,
  getActiveProfile,
  resetActiveProfile,
  saveActiveProfile,
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
import { BIOMETRIC_FIELD_OPTIONS } from "../config/biometrics";
import { EXPERIENCE_TIER_OPTIONS } from "../config/experience";
import onboardingSource from "../ui/Onboarding.tsx?raw";
import goalSelectSource from "../ui/GoalSelect.tsx?raw";
import hardwareMapSource from "../ui/HardwareMap.tsx?raw";
import lifestyleRecoverySource from "../ui/LifestyleRecovery.tsx?raw";
import lifestyleConfigSource from "../config/lifestyle.ts?raw";
import orthopedicLimitationsSource from "../ui/OrthopedicLimitations.tsx?raw";
import limitationsConfigSource from "../config/limitations.ts?raw";
import payloadPreviewSource from "../ui/PayloadPreview.tsx?raw";
import biometricsFormSource from "../ui/BiometricsForm.tsx?raw";
import biometricsConfigSource from "../config/biometrics.ts?raw";
import experienceTierSelectSource from "../ui/ExperienceTierSelect.tsx?raw";
import experienceConfigSource from "../config/experience.ts?raw";

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

function tierGroup(): HTMLElement {
  return screen.getByRole("group", { name: "Experience tier" });
}

/** Completes the required foundation fields: Age 30, Height 178, Weight 75,
    tier Intermediate (scoped to the tier group — chips collide with lifestyle). */
function fillRequiredProfile(): void {
  fireEvent.change(screen.getByRole("spinbutton", { name: "Age" }), { target: { value: "30" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Height" }), { target: { value: "178" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Weight" }), { target: { value: "75" } });
  fireEvent.click(within(tierGroup()).getByRole("button", { name: "Intermediate" }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  resetComposerStatus();
  resetActivePlan();
  // WHY: the profile store is module-global; every generating/reading test
  // must leave the first-run fixture behind (plan A11).
  resetActiveProfile();
});

describe("features onboarding B1", () => {
  it("Generate stays gated on required profile: goal selection alone does not enable it", () => {
    render(<Onboarding onGenerated={vi.fn()} />);
    const generate = generateButton();
    const mobility = screen.getByRole("button", { name: "Mobility" });

    expect(generate.disabled).toBe(true);
    // Goal alone is not enough — biometrics/tier are unanswered.
    fireEvent.click(mobility);
    expect(generate.disabled).toBe(true);

    // After the required fill, the goal toggle again drives enable/disable.
    fillRequiredProfile();
    expect(generate.disabled).toBe(false);
    fireEvent.click(mobility);
    expect(generate.disabled).toBe(true);
    fireEvent.click(mobility);
    expect(generate.disabled).toBe(false);
  });

  it("Generate stays disabled with the required profile filled but no goal", () => {
    render(<Onboarding onGenerated={vi.fn()} />);
    fillRequiredProfile();
    expect(generateButton().disabled).toBe(true);
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
    fillRequiredProfile();
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

  it("sent payload carries numeric biometrics + tier id and never the volume multiplier", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));

    render(<Onboarding onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fillRequiredProfile();
    fireEvent.click(generateButton());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const sentBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body)) as {
      profile: { biometrics: { ageYears: number; heightCm: number; weightKg: number }; experienceTier: string };
    };
    expect(sentBody.profile.biometrics).toEqual({ ageYears: 30, heightCm: 178, weightKg: 75 });
    expect(sentBody.profile.experienceTier).toBe("intermediate");
    // A4: only the tier id travels — the wire never carries a multiplier.
    expect(String(fetchMock.mock.calls[0]?.[1].body)).not.toContain("multiplier");
    expect(String(fetchMock.mock.calls[0]?.[1].body)).not.toContain('"volume":');
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
    fillRequiredProfile();
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
    fillRequiredProfile();
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
    fillRequiredProfile();
    fireEvent.click(generateButton());

    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith(ONE_WEEK_PLAN));
    expect(onGenerated).toHaveBeenCalledTimes(1);
  });

  it("disables Generate when composer is offline even with a complete profile", () => {
    render(<Onboarding onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fillRequiredProfile();
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

describe("features onboarding — required biometrics + experience tier", () => {
  function pressedTierNames(): string[] {
    return within(tierGroup())
      .queryAllByRole("button")
      .filter((chip) => chip.getAttribute("aria-pressed") === "true")
      .map((chip) => chip.textContent ?? "");
  }

  it("renders Body metrics with three spinbuttons and Training experience with three unpressed chips", () => {
    render(<Onboarding onGenerated={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Body metrics" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Training experience" })).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Age" })).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Height" })).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Weight" })).toBeTruthy();

    expect(tierGroup()).toBeTruthy();
    for (const option of EXPERIENCE_TIER_OPTIONS) {
      const chip = within(tierGroup()).getByRole("button", { name: option.label });
      expect(chip.getAttribute("aria-pressed")).toBe("false");
    }
    expect(pressedTierNames()).toEqual([]);
  });

  it("first-run preview carries profile.biometrics: null and profile.experienceTier: null", () => {
    render(<Onboarding onGenerated={vi.fn()} />);

    const preview = JSON.parse(previewCodeText()) as {
      profile: { biometrics: unknown; experienceTier: unknown };
    };
    expect(preview.profile.biometrics).toBeNull();
    expect(preview.profile.experienceTier).toBeNull();
  });

  it("empty biometrics with a goal keeps Generate disabled and shows required hints", () => {
    render(<Onboarding onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));

    expect(generateButton().disabled).toBe(true);
    expect(screen.getByText("Age is required.")).toBeTruthy();
    expect(screen.getByText("Height is required.")).toBeTruthy();
    expect(screen.getByText("Weight is required.")).toBeTruthy();
  });

  it("biometrics without a tier keeps Generate disabled", () => {
    render(<Onboarding onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Age" }), { target: { value: "30" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Height" }), { target: { value: "178" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Weight" }), { target: { value: "75" } });

    expect(generateButton().disabled).toBe(true);
    fireEvent.click(within(tierGroup()).getByRole("button", { name: "Intermediate" }));
    expect(generateButton().disabled).toBe(false);
  });

  it("out-of-range age shows the exact message and keeps Generate disabled", () => {
    render(<Onboarding onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Age" }), { target: { value: "105" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Height" }), { target: { value: "178" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Weight" }), { target: { value: "75" } });

    expect(screen.getByText("Age must be between 13 and 100 years.")).toBeTruthy();
    expect(generateButton().disabled).toBe(true);

    // Fixing the age re-enables (with a tier picked).
    fireEvent.change(screen.getByRole("spinbutton", { name: "Age" }), { target: { value: "30" } });
    fireEvent.click(within(tierGroup()).getByRole("button", { name: "Intermediate" }));
    expect(generateButton().disabled).toBe(false);
  });

  it("decimal age is rejected as a whole-number field, decimal weight is accepted", () => {
    render(<Onboarding onGenerated={vi.fn()} />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Age" }), { target: { value: "30.5" } });
    expect(screen.getByText("Age must be a whole number.")).toBeTruthy();

    fillRequiredProfile();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Weight" }), { target: { value: "75.5" } });
    expect(screen.queryByText("Weight must be a whole number.")).toBeNull();
    const preview = JSON.parse(previewCodeText()) as { profile: { biometrics: { weightKg: number } } };
    expect(preview.profile.biometrics.weightKg).toBe(75.5);
  });

  it("valid input + tier updates the preview to numeric biometrics and the tier id", () => {
    render(<Onboarding onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fillRequiredProfile();

    const preview = JSON.parse(previewCodeText()) as {
      profile: { biometrics: { ageYears: number; heightCm: number; weightKg: number }; experienceTier: string };
    };
    expect(preview.profile.biometrics).toEqual({ ageYears: 30, heightCm: 178, weightKg: 75 });
    expect(preview.profile.experienceTier).toBe("intermediate");
  });

  it("pending freezes the number inputs and ignores tier clicks", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));

    render(<Onboarding onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fillRequiredProfile();
    fireEvent.click(generateButton());
    expect(generateButton().disabled).toBe(true);

    const age = screen.getByRole("spinbutton", { name: "Age" }) as HTMLInputElement;
    const height = screen.getByRole("spinbutton", { name: "Height" }) as HTMLInputElement;
    const weight = screen.getByRole("spinbutton", { name: "Weight" }) as HTMLInputElement;
    expect(age.disabled).toBe(true);
    expect(height.disabled).toBe(true);
    expect(weight.disabled).toBe(true);

    fireEvent.click(within(tierGroup()).getByRole("button", { name: "Advanced" }));
    expect(pressedTierNames()).toEqual(["Intermediate"]);
  });

  it("successful generate persists the sent profile via getActiveProfile()", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));
    const onGenerated = vi.fn();

    render(<Onboarding onGenerated={onGenerated} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fillRequiredProfile();
    fireEvent.click(generateButton());
    await waitFor(() => expect(onGenerated).toHaveBeenCalledTimes(1));

    const stored = getActiveProfile();
    expect(stored.biometrics).toEqual({ ageYears: 30, heightCm: 178, weightKg: 75 });
    expect(stored.experienceTier).toBe("intermediate");
  });

  it("nothing is persisted on a failed generate", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    const onGenerated = vi.fn();

    render(<Onboarding onGenerated={onGenerated} />);
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    fillRequiredProfile();
    fireEvent.click(generateButton());
    await screen.findByRole("alert");

    expect(getActiveProfile().biometrics).toBeNull();
    expect(getActiveProfile().experienceTier).toBeNull();
  });

  it("a persisted profile seeds the form values and pressed tier on re-entry", () => {
    saveActiveProfile({
      ...getActiveProfile(),
      biometrics: { ageYears: 41, heightCm: 182, weightKg: 88.5 },
      experienceTier: "advanced",
    });

    render(<Onboarding onGenerated={vi.fn()} />);

    const age = screen.getByRole("spinbutton", { name: "Age" }) as HTMLInputElement;
    const height = screen.getByRole("spinbutton", { name: "Height" }) as HTMLInputElement;
    const weight = screen.getByRole("spinbutton", { name: "Weight" }) as HTMLInputElement;
    expect(age.value).toBe("41");
    expect(height.value).toBe("182");
    expect(weight.value).toBe("88.5");
    expect(pressedTierNames()).toEqual(["Advanced"]);
    // Stored data makes the CTA ready with only a goal.
    fireEvent.click(screen.getByRole("button", { name: "Strength" }));
    expect(generateButton().disabled).toBe(false);
  });

  it("profile override seeds the required fields the same way (test-only prop contract)", () => {
    render(
      <Onboarding
        onGenerated={vi.fn()}
        profile={{
          ...getActiveProfile(),
          biometrics: { ageYears: 55, heightCm: 171, weightKg: 60 },
          experienceTier: "novice",
        }}
      />,
    );

    expect((screen.getByRole("spinbutton", { name: "Age" }) as HTMLInputElement).value).toBe("55");
    expect(
      within(tierGroup()).getByRole("button", { name: "Novice" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("keeps option ids aligned with the canonical entity tuples", () => {
    expect(BIOMETRIC_FIELD_OPTIONS.map((option) => option.id)).toEqual([...BIOMETRIC_FIELDS]);
    expect(EXPERIENCE_TIER_OPTIONS.map((option) => option.id)).toEqual([...EXPERIENCE_TIER_IDS]);
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
      biometricsFormSource,
      biometricsConfigSource,
      experienceTierSelectSource,
      experienceConfigSource,
    ];
    for (const source of sources) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|fetch\s*\(|axios|react-router/i);
    }
  });

  it("onboarding lifestyle, biometrics and orthopedic sources leak no data off the device (payload is the only egress)", () => {
    const sources = [
      onboardingSource,
      lifestyleRecoverySource,
      lifestyleConfigSource,
      orthopedicLimitationsSource,
      limitationsConfigSource,
      biometricsFormSource,
      biometricsConfigSource,
      experienceTierSelectSource,
      experienceConfigSource,
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

  it("generate with a goal and the required profile POSTs the preview body including default lifestyle", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));
    const onGenerated = vi.fn();

    render(<Onboarding onGenerated={onGenerated} />);
    fireEvent.click(screen.getByRole("button", { name: "Endurance" }));
    fillRequiredProfile();
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
    fillRequiredProfile();
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
    fillRequiredProfile();
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
    fillRequiredProfile();
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
    fillRequiredProfile();
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
