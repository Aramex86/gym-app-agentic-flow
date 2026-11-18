/* entities/training-plan — API wire tests (node env, no DOM). */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PlanGenerateError,
  PlanRecomposeError,
  generatePlan,
  getTrainingPlan,
  recomposePlan,
} from "../api";
import type { GeneratePlanRequest, RecomposePlanRequest, TrainingPlan } from "../types";
import { getActiveProfile } from "@entities/profile";
import { SAMPLE_PLAN } from "@shared/config/plan.sample";
import { resetActivePlan } from "@shared/config/activePlan";

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

const BASE_REQUEST: RecomposePlanRequest = {
  profile: getActiveProfile(),
  plan: SAMPLE_PLAN,
  instruction: "make it a one-week full-body plan",
};

const GENERATE_REQUEST: GeneratePlanRequest = {
  profile: getActiveProfile(),
  goals: ["strength", "mobility"],
  hardware: ["heart-rate-strap", "smart-watch", "phone-logger"],
};

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  } as unknown as Response;
}

function jsonRejectingResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.reject(new SyntaxError("Unexpected token")),
  } as unknown as Response;
}

function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("expected the promise to reject");
    },
    (error) => error,
  );
}

const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  resetActivePlan();
});

describe("entities training-plan recomposePlan — success", () => {
  it("POSTs profile + plan + instruction to /api/plan and returns the validated plan", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));

    await expect(recomposePlan(BASE_REQUEST)).resolves.toEqual(ONE_WEEK_PLAN);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/plan");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({
      profile: BASE_REQUEST.profile,
      plan: SAMPLE_PLAN,
      instruction: "make it a one-week full-body plan",
    });
  });
});

describe("entities training-plan recomposePlan — failure modes", () => {
  it("network rejection -> Could not reach the plan composer.", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));

    const error = await rejectionOf(recomposePlan(BASE_REQUEST));
    expect(error).toBeInstanceOf(PlanRecomposeError);
    expect((error as PlanRecomposeError).message).toBe("Could not reach the plan composer.");
  });
});

describe("entities training-plan generatePlan", () => {
  it("POSTs to /api/plan/generate with JSON content type and request body", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));

    await expect(generatePlan(GENERATE_REQUEST)).resolves.toEqual(ONE_WEEK_PLAN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/plan/generate");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual(GENERATE_REQUEST);
  });

  it("returns the valid plan and getTrainingPlan reads it afterward", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));

    await expect(generatePlan(GENERATE_REQUEST)).resolves.toEqual(ONE_WEEK_PLAN);
    expect(getTrainingPlan()).toBe(ONE_WEEK_PLAN);
  });

  it("network reject throws PlanGenerateError and store stays sample", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));

    const error = await rejectionOf(generatePlan(GENERATE_REQUEST));
    expect(error).toBeInstanceOf(PlanGenerateError);
    expect(getTrainingPlan()).toBe(SAMPLE_PLAN);
  });

  it("HTTP 500 throws PlanGenerateError and store stays sample", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));

    const error = await rejectionOf(generatePlan(GENERATE_REQUEST));
    expect(error).toBeInstanceOf(PlanGenerateError);
    expect(getTrainingPlan()).toBe(SAMPLE_PLAN);
  });

  it("invalid JSON throws PlanGenerateError and store stays sample", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonRejectingResponse());

    const error = await rejectionOf(generatePlan(GENERATE_REQUEST));
    expect(error).toBeInstanceOf(PlanGenerateError);
    expect(getTrainingPlan()).toBe(SAMPLE_PLAN);
  });

  it("invalid plan throws PlanGenerateError and store stays sample", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({ schemaVersion: "0.1" }));

    const error = await rejectionOf(generatePlan(GENERATE_REQUEST));
    expect(error).toBeInstanceOf(PlanGenerateError);
    expect(getTrainingPlan()).toBe(SAMPLE_PLAN);
  });
});

describe("entities training-plan getTrainingPlan", () => {
  it("returns sample plan when active-plan store is empty", () => {
    resetActivePlan();
    expect(getTrainingPlan()).toBe(SAMPLE_PLAN);
  });
});
