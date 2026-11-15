/* entities/training-plan — recomposePlan wire tests (node env, no DOM).
   The ONLY fetch in the entity is under test here: every failure mode of
   plan A3 (network, HTTP, invalid JSON, plan failing R1-R9) normalizes to
   PlanRecomposeError with the fixed message fragments; success returns the
   validated plan and the request body carries profile + plan + instruction
   verbatim (input normalization belongs to the feature, plan A4). */

import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanRecomposeError, recomposePlan } from "../api";
import type { RecomposePlanRequest, TrainingPlan } from "../types";
import { getActiveProfile } from "@entities/profile";
import { SAMPLE_PLAN } from "@shared/config/plan.sample";

/* Minimal VALID one-week plan (validatePlan R1-R9: 1 week -> 1+ contiguous
   day(s) -> 1+ exercise(s), non-empty strings, integer ranges). */
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

/* Typed narrower than fetch: the entity always calls (string, RequestInit),
   so the assertions below read init without undefined-guards. */
/* Captures the rejected error WITHOUT re-invoking the call: mocking in these
   tests is Once-scoped, so each fetch must be called exactly once per test. */
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

  it("does not trim or mutate the instruction (feature owns normalization, plan A4)", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(ONE_WEEK_PLAN));

    await recomposePlan({ ...BASE_REQUEST, instruction: "  padded  " });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body));
    expect(body.instruction).toBe("  padded  ");
  });
});

describe("entities training-plan recomposePlan — failure modes (plan A3)", () => {
  it("network rejection -> Could not reach the plan composer.", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));

    const error = await rejectionOf(recomposePlan(BASE_REQUEST));
    expect(error).toBeInstanceOf(PlanRecomposeError);
    expect((error as PlanRecomposeError).message).toBe("Could not reach the plan composer.");
  });

  it("HTTP 500 -> Plan composer failed (HTTP 500).", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));

    const error = await rejectionOf(recomposePlan(BASE_REQUEST));
    expect(error).toBeInstanceOf(PlanRecomposeError);
    expect((error as PlanRecomposeError).message).toBe("Plan composer failed (HTTP 500).");
  });

  it("invalid JSON body -> Plan composer returned invalid JSON.", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonRejectingResponse());

    const error = await rejectionOf(recomposePlan(BASE_REQUEST));
    expect(error).toBeInstanceOf(PlanRecomposeError);
    expect((error as PlanRecomposeError).message).toBe("Plan composer returned invalid JSON.");
  });

  it("plan failing validatePlan -> Plan composer returned an invalid plan: <first issue>.", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse({ schemaVersion: "0.1" }));

    const error = await rejectionOf(recomposePlan(BASE_REQUEST));
    expect(error).toBeInstanceOf(PlanRecomposeError);
    expect((error as PlanRecomposeError).message).toBe(
      "Plan composer returned an invalid plan: planId must be non-empty and match /^[a-z0-9-]+$/.",
    );
  });
});
