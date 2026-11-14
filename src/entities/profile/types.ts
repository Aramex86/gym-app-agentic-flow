/* entities/profile — cross-feature data model for the active user profile.
   Business consumers (features/pages) import only @entities/profile. */

export interface UserProfile {
  id: string;
  name: string;
  /** Declared medical conditions; empty when the user listed none. */
  diseases: readonly string[];
  /** Declared physical problems (e.g. injuries); empty when none. */
  physicalProblems: readonly string[];
}
