/* entities/profile — public API. Consumers import ONLY here
   (@entities/profile), never deep entity paths. */

export type { UserProfile } from "./types";
export { getActiveProfile } from "./api";
export { hasHealthConditions } from "./slice";
