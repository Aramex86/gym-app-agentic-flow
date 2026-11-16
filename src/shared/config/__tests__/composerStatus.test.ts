/* shared/config/composerStatus — node-safe store tests. The store is
   module-global, so resetComposerStatus() runs in afterEach to keep tests
   order-independent (plan §6). */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getComposerStatus,
  isComposerAvailable,
  resetComposerStatus,
  setComposerStatus,
  subscribeComposerStatus,
  useComposerStatus,
} from "../composerStatus";

afterEach(() => {
  resetComposerStatus();
});

describe("shared/config composerStatus — store semantics", () => {
  it("starts at unknown (plan A3: nothing disables before the first check)", () => {
    expect(getComposerStatus()).toBe("unknown");
  });

  it("setComposerStatus notifies exactly once per real change, never on same value", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeComposerStatus(listener);

    setComposerStatus("online");
    setComposerStatus("online");
    expect(listener).toHaveBeenCalledTimes(1);

    setComposerStatus("offline");
    expect(getComposerStatus()).toBe("offline");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("unsubscribing stops notifications (listener set copies during notify)", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeComposerStatus(listener);
    unsubscribe();

    setComposerStatus("online");
    expect(listener).not.toHaveBeenCalled();
  });

  it("self-unsubscribing during notify cannot corrupt the iteration", () => {
    const seen: string[] = [];
    let unsubscribeMiddle: () => void = () => {};
    const middle = vi.fn(() => {
      seen.push("middle");
      unsubscribeMiddle(); // self-unsubscribe mid-notify (plan §5.2 copy rule)
    });

    subscribeComposerStatus(() => {
      seen.push("first");
    });
    unsubscribeMiddle = subscribeComposerStatus(middle);
    subscribeComposerStatus(() => {
      seen.push("last");
    });

    setComposerStatus("online");
    // The snapshot-copy iteration is stable: every listener runs exactly
    // once; no skipped entry, no mutation crash.
    expect(seen).toEqual(["first", "middle", "last"]);
  });
});

describe("shared/config composerStatus — CTA availability (plan A3)", () => {
  it("isComposerAvailable is true for unknown/online and false ONLY for offline", () => {
    expect(isComposerAvailable("unknown")).toBe(true);
    expect(isComposerAvailable("online")).toBe(true);
    expect(isComposerAvailable("offline")).toBe(false);
  });

  it("defaults to the current store status", () => {
    expect(isComposerAvailable()).toBe(true);
    setComposerStatus("offline");
    expect(isComposerAvailable()).toBe(false);
  });
});

describe("shared/config composerStatus — React + test seams", () => {
  it("useComposerStatus is a valid hook reference (server snapshot = sync getter)", () => {
    expect(typeof useComposerStatus).toBe("function");
  });

  it("resetComposerStatus restores unknown (test seam in afterEach)", () => {
    setComposerStatus("offline");
    resetComposerStatus();
    expect(getComposerStatus()).toBe("unknown");
  });
});
