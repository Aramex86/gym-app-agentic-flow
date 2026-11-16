/* features/app-shell/ui/AppChrome — the app chrome scenario: wires the
   composer healthcheck cadence (plan A6) into the shared AppShell slots —
   header-right telemetry indicator + bottom navigation. App (main.tsx)
   renders this INSTEAD of AppShell; app is the top layer, so importing a
   feature is downward. */

import { useEffect } from "react";
import type { JSX, ReactNode } from "react";
import { AppShell } from "@shared/ui";
import {
  COMPOSER_HEALTH_INTERVAL_MS,
  refreshComposerStatus,
  useComposerStatus,
} from "@entities/composer";
import { BottomNav } from "./BottomNav";
import { ComposerStatusIndicator } from "./ComposerStatusIndicator";

/** Props of the app chrome (shell + telemetry + nav). */
export interface AppChromeProps {
  children: ReactNode;
  /** Test-only override; production uses COMPOSER_HEALTH_INTERVAL_MS. */
  healthcheckIntervalMs?: number;
}

export function AppChrome({
  children,
  healthcheckIntervalMs = COMPOSER_HEALTH_INTERVAL_MS,
}: AppChromeProps): JSX.Element {
  const status = useComposerStatus();

  // Plan A6: one check on mount, then every interval. refreshComposerStatus
  // writes the shared store; the re-render comes from useComposerStatus.
  // StrictMode double-invocation (dev only) is harmless — the check is a
  // pure GET and the store dedupes identical values.
  useEffect(() => {
    void refreshComposerStatus();
    const timer = setInterval(() => {
      void refreshComposerStatus();
    }, healthcheckIntervalMs);
    return () => clearInterval(timer);
  }, [healthcheckIntervalMs]);

  return (
    // WHY: stitch gate decision 1 — the glass header's brand stack line 1 is
    // the design's word "Kinetix", not SITE.name ("FSAA" stays the repo/site
    // config; the header brand is the app chrome only).
    <AppShell
      title="Kinetix"
      headerRight={<ComposerStatusIndicator status={status} />}
      bottomNav={<BottomNav />}
    >
      {children}
    </AppShell>
  );
}
