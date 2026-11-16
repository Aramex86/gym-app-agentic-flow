/* entities/composer — node-safe data-access tests (fetch stubbed with
   vi.stubGlobal, plan A7: tests never hit the network). Pins the A2
   contract: GET /api/composer/health, any 2xx → online, anything else
   (non-2xx / rejection) → offline, and refreshComposerStatus writing the
   shared store. The store is module-global → resetComposerStatus() in
   afterEach. */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMPOSER_HEALTH_ENDPOINT,
  checkComposerHealth,
  refreshComposerStatus,
} from "@entities/composer";
import {
  getComposerStatus,
  resetComposerStatus,
} from "@shared/config/composerStatus";

const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>();

function healthResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  resetComposerStatus();
});

describe("entities composer — checkComposerHealth (plan A2 contract)", () => {
  it("calls GET on the healthcheck endpoint (one constant)", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(healthResponse(204));

    await checkComposerHealth();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(COMPOSER_HEALTH_ENDPOINT);
    expect(COMPOSER_HEALTH_ENDPOINT).toBe("/api/composer/health");
    expect(fetchMock.mock.calls[0]?.[1].method).toBe("GET");
  });

  it("any 2xx → online (no body read)", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(healthResponse(204));
    await expect(checkComposerHealth()).resolves.toBe("online");

    fetchMock.mockResolvedValueOnce(healthResponse(200));
    await expect(checkComposerHealth()).resolves.toBe("online");
  });

  it("non-2xx → offline", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(healthResponse(503));
    await expect(checkComposerHealth()).resolves.toBe("offline");

    fetchMock.mockResolvedValueOnce(healthResponse(404));
    await expect(checkComposerHealth()).resolves.toBe("offline");
  });

  it("network rejection → offline (throws are normalized, never rethrown)", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    await expect(checkComposerHealth()).resolves.toBe("offline");
  });
});

describe("entities composer — refreshComposerStatus (shared store write)", () => {
  it("writes online on 2xx", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(healthResponse(200));
    await expect(refreshComposerStatus()).resolves.toBe("online");
    expect(getComposerStatus()).toBe("online");
  });

  it("writes offline on failure", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValueOnce(new TypeError("down"));
    await expect(refreshComposerStatus()).resolves.toBe("offline");
    expect(getComposerStatus()).toBe("offline");
  });
});
