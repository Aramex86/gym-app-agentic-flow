/* shared/config/nav — plain nav data (FSAA: no React, no router).
   Single source of truth for the bottom-tab labels/paths; the Surface↔route
   pairing (plan A1: My Plan→/progress, Progress→/) is encoded ONLY here. */

/** Stable identity of a bottom-navigation tab. */
export type NavSurfaceId = "my-plan" | "progress" | "logger" | "onboarding";

/** One bottom-navigation entry: label is exact task copy, path is a route
    registered in src/pages/router.tsx. */
export interface NavSurface {
  id: NavSurfaceId;
  label: string;
  path: string;
}

/** All tab surfaces in display order. Onboarding is registered here (its
    route exists) but is NOT rendered on the bar — see NAV_TAB_IDS/NAV_FAB_ID. */
export const NAV_SURFACES: readonly NavSurface[] = [
  { id: "my-plan", label: "My Plan", path: "/progress" },
  { id: "progress", label: "Progress", path: "/" },
  { id: "logger", label: "Logger", path: "/logger" },
  { id: "onboarding", label: "Onboarding", path: "/onboarding" },
] as const;

/**
 * Ids of the flat tabs shown LEFT and RIGHT of the raised center FAB
 * (stitch gate decision 2 / stitch-appshell-ref §2: 3-slot bar — My Plan |
 * [FAB] | Progress). Onboarding stays off the bar as an entry gate.
 */
export const NAV_TAB_IDS: readonly NavSurfaceId[] = ["my-plan", "progress"] as const;

/** Id of the surface the raised center FAB targets (Logger, bolt action). */
export const NAV_FAB_ID: NavSurfaceId = "logger";

/**
 * Looks up a surface by id (labels/paths for the FAB come from here so the
 * bar config stays the single source of truth).
 */
export function navSurfaceById(id: NavSurfaceId): NavSurface | undefined {
  return NAV_SURFACES.find((surface) => surface.id === id);
}

/**
 * Maps a URL pathname to the active surface id.
 * Exact pathname matching only (plan §5.1): nested/deep paths return null
 * so no tab is falsely highlighted; a later nested-route card extends this.
 */
export function activeNavSurface(pathname: string): NavSurfaceId | null {
  const hit = NAV_SURFACES.find((surface) => surface.path === pathname);
  return hit ? hit.id : null;
}
