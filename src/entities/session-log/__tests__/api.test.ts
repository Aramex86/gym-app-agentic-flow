/* entities/session-log — gym-gate insight request tests (node env). Fetch is
   stubbed with vi.stubGlobal (never hit the network); the wire contract
   pinned here mirrors docs/contracts/progress-insight.md. */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INSIGHT_ENDPOINT,
  INSIGHT_MODEL,
  InsightRequestError,
  getSessionLog,
  requestReviewInsight,
  selectInsightSessionSummaries,
  selectReviewPeriod,
  selectSessionLogRows,
} from "../index";

const VALID_INSIGHT = {
  periodId: "last-4-weeks",
  model: INSIGHT_MODEL,
  insight: "Bench progressed twice; squat PR at 122.5 kg e1RM.",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  } as unknown as Response;
}

function insightInput() {
  const entries = getSessionLog();
  const period = selectReviewPeriod(entries)!;
  const sessions = selectInsightSessionSummaries(selectSessionLogRows(entries), period);
  return { period, sessions };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("entities/session-log getSessionLog", () => {
  it("returns the stable, non-empty ascending sample", () => {
    const first = getSessionLog();
    expect(first.length).toBe(6);
    expect(getSessionLog()).toBe(first);
    expect(first.map((entry) => entry.date)).toEqual([...first.map((entry) => entry.date)].sort());
  });
});

describe("entities/session-log requestReviewInsight — wire shape", () => {
  it("POSTs model + period + 6 summaries to the gate endpoint only", async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      () => Promise.resolve(jsonResponse(VALID_INSIGHT)),
    );
    vi.stubGlobal("fetch", fetchMock);

    const input = insightInput();
    const insight = await requestReviewInsight(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(INSIGHT_ENDPOINT);
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("kimi-k3.1");
    expect(body.period).toEqual(input.period);
    expect(body.sessions).toEqual(input.sessions);
    expect(body.sessions.length).toBe(6);
    expect(insight).toEqual(VALID_INSIGHT);
  });
});

describe("entities/session-log requestReviewInsight — failure modes", () => {
  it("HTTP 500 throws InsightRequestError", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(VALID_INSIGHT, 500))));
    await expect(requestReviewInsight(insightInput())).rejects.toBeInstanceOf(InsightRequestError);
  });

  it("network rejection throws InsightRequestError", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    await expect(requestReviewInsight(insightInput())).rejects.toBeInstanceOf(InsightRequestError);
  });

  it("invalid JSON throws InsightRequestError", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error("invalid json")),
      } as unknown as Response),
    ));
    await expect(requestReviewInsight(insightInput())).rejects.toBeInstanceOf(InsightRequestError);
  });

  it.each([
    ["empty insight", { periodId: "last-4-weeks", model: INSIGHT_MODEL, insight: "" }],
    ["mismatched periodId", { periodId: "other", model: INSIGHT_MODEL, insight: "text" }],
    ["missing model", { periodId: "last-4-weeks", insight: "text" }],
    ["non-object payload", "nope"],
  ])("invalid payload (%s) throws InsightRequestError", async (_name, payload) => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(payload))));
    await expect(requestReviewInsight(insightInput())).rejects.toBeInstanceOf(InsightRequestError);
  });
});
