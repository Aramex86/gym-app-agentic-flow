/* entities/composer/api — data access for the composer healthcheck.
   The ONLY fetch for composer connectivity (AGENTS.md data rule: entities
   own fetch; features/pages never do). Wire contract (plan A2 — assumed;
   the gym-gate backend owner aligns ONLY on this constant):
   GET <endpoint>, any 2xx → online (no body is read); non-2xx, network
   failure or timeout → offline. The /api/plan composer contract
   (docs/contracts/plan-schema.md) is untouched. */

import { setComposerStatus } from "@shared/config/composerStatus";
import type { ComposerStatus } from "./types";

/** Composer healthcheck endpoint (same origin as the POST /api/plan path). */
export const COMPOSER_HEALTH_ENDPOINT = "/api/composer/health";
/** Healthcheck cadence after the initial mount check (plan A6). */
export const COMPOSER_HEALTH_INTERVAL_MS = 30_000;
/** A check slower than this counts as offline (plan A2). */
export const COMPOSER_HEALTH_TIMEOUT_MS = 5_000;

/**
 * One healthcheck round trip. NEVER touches the shared store — callers
 * decide what to do with the result (refreshComposerStatus writes it).
 * Uses AbortSignal.timeout when the runtime provides it; without it the
 * check simply has no signal guard (older runtimes).
 */
export async function checkComposerHealth(): Promise<ComposerStatus> {
  const hasTimeoutSignal =
    typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function";
  try {
    const response = await fetch(COMPOSER_HEALTH_ENDPOINT, {
      method: "GET",
      signal: hasTimeoutSignal ? AbortSignal.timeout(COMPOSER_HEALTH_TIMEOUT_MS) : undefined,
    });
    // WHY: plan A2 — any 2xx counts as online; the body is never read, so
    // the backend only needs to return a status, not a payload.
    return response.ok ? "online" : "offline";
  } catch {
    return "offline";
  }
}

/**
 * Runs one healthcheck and writes the result into the shared store.
 * Returns the new status (also convenient for tests). Send behavior of
 * POST /api/plan is NOT affected — status is the last healthcheck, not
 * the last send (plan A3).
 */
export async function refreshComposerStatus(): Promise<ComposerStatus> {
  const next = await checkComposerHealth();
  setComposerStatus(next);
  return next;
}
