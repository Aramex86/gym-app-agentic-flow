// @vitest-environment jsdom
/* features/progress-insight — DOM tests of the AI review card (task S7).
   fetch is stubbed with vi.stubGlobal; vitest globals are off, so cleanup()
   and vi.unstubAllGlobals() are explicit in afterEach. Source guards pin the
   no-fetch / no-provider-URL rule for the feature UI. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { InsightCard } from "../ui/InsightCard";
import insightCardSource from "../ui/InsightCard.tsx?raw";
import { SESSION_LOG_SAMPLE } from "@entities/session-log";

/* A valid gate 2xx body (docs/contracts/progress-insight.md shape; the
   periodId must match the sample's derived "last-4-weeks"). */
const VALID_INSIGHT = {
  periodId: "last-4-weeks",
  model: "kimi-k3.1",
  insight: "Bench progressed twice; squat PR at 122.5 kg e1RM.",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  } as unknown as Response;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("features/progress-insight InsightCard — lifecycle", () => {
  it("starts pending: skeleton with the accessible name, no insight text", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    render(<InsightCard />);

    expect(screen.getByRole("status", { name: "Loading AI review" })).toBeTruthy();
    expect(screen.queryByText(VALID_INSIGHT.insight)).toBeNull();
  });

  it("resolves a valid gate payload to the insight prose (skeleton gone)", async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      () => Promise.resolve(jsonResponse(VALID_INSIGHT)),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<InsightCard />);

    expect(await screen.findByText(VALID_INSIGHT.insight)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("on HTTP 500 shows the fixed alert copy and Retry; retry requests once more, then succeeds", async () => {
    const fetchMock = vi.fn<(input: unknown) => Promise<Response>>();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse(VALID_INSIGHT));
    vi.stubGlobal("fetch", fetchMock);

    render(<InsightCard />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Could not load the AI review.");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText(VALID_INSIGHT.insight)).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("on a network rejection the retry path also clears the error on success", async () => {
    const fetchMock = vi.fn<(input: unknown) => Promise<Response>>();
    fetchMock
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(jsonResponse(VALID_INSIGHT));
    vi.stubGlobal("fetch", fetchMock);

    render(<InsightCard />);
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText(VALID_INSIGHT.insight)).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("contacts only /api/progress/insight — no provider host, model id in the body", async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      () => Promise.resolve(jsonResponse(VALID_INSIGHT)),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<InsightCard />);
    await screen.findByText(VALID_INSIGHT.insight);

    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe("/api/progress/insight");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("kimi-k3.1");
      expect(body.period.id).toBe("last-4-weeks");
      expect(body.sessions.length).toBe(6);
    }
  });

  it("shows the muted empty state when no sessions exist", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<InsightCard entries={[]} />);
    expect(await screen.findByText("No sessions in this period yet.")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders the provenance line (model · period label) while pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    render(<InsightCard />);
    expect(screen.getByText("kimi-k3.1 · Last 4 weeks")).toBeTruthy();
  });
});

describe("features/progress-insight — source guards", () => {
  it("feature UI has no fetch/axios and no kimi/provider hardcode (model lives in the entity)", () => {
    expect(insightCardSource).not.toMatch(/fetch\s*\(|axios|kimi-k3/i);
    expect(insightCardSource).not.toMatch(/https?:\/\/(?!localhost)/i);
  });

  it("feature UI contains no hex or rgb() colors (tokens only)", () => {
    expect(insightCardSource).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
  });
});
