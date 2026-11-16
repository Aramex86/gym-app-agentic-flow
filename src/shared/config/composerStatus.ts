/* shared/config/composerStatus — module-level composer health store.
   One app-global status read by the shell indicator and PlanRecompose so a
   healthcheck on any page gates every composer CTA plan-wide. React is the
   only import: this file never fetches (that is src/entities/composer/api.ts)
   and imports no entities (shared stays the bottom layer). */

import { useSyncExternalStore } from "react";

/** Last healthcheck result. `unknown` = no check yet (CTA stays enabled —
    only a CONFIRMED failure disables, plan A3). */
export type ComposerStatus = "unknown" | "online" | "offline";

let status: ComposerStatus = "unknown";
const listeners = new Set<() => void>();

/**
 * Synchronous snapshot of the composer status (also the server snapshot for
 * useSyncExternalStore, so renderToString stays safe).
 */
export function getComposerStatus(): ComposerStatus {
  return status;
}

/**
 * Sets the status and notifies subscribers — only when the value actually
 * changed, so repeated identical healthchecks never trigger re-renders.
 */
export function setComposerStatus(next: ComposerStatus): void {
  if (next === status) return;
  status = next;
  // WHY: copy before iterating — a listener unsubscribing during notify
  // must not mutate the set mid-iteration.
  for (const listener of [...listeners]) {
    listener();
  }
}

/**
 * Subscribes to status changes; returns the unsubscribe function.
 */
export function subscribeComposerStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * React hook over the store. getComposerStatus (same synchronous snapshot)
 * serves as the server snapshot argument, keeping SSR rendering consistent.
 */
export function useComposerStatus(): ComposerStatus {
  return useSyncExternalStore(subscribeComposerStatus, getComposerStatus, getComposerStatus);
}

/**
 * Whether the composer CTA may be used for this status.
 * False ONLY for "offline" (plan A3): unknown/online never block.
 */
export function isComposerAvailable(status: ComposerStatus = getComposerStatus()): boolean {
  return status !== "offline";
}

/**
 * Test seam only: restores the pristine "unknown" state
 * (tests must reset in afterEach — the store is module-global).
 * Not exported from @entities/composer.
 */
export function resetComposerStatus(): void {
  setComposerStatus("unknown");
}
