/* features/onboarding/ui/Onboarding — onboarding scenario root.
   Layer reason: feature-level state orchestration for required biometrics, the
   experience tier, goals, payload preview, and the generate CTA. The CTA stays
   disabled until a goal is chosen AND the required biometrics are valid AND a
   tier is selected; a successful generate persists the sent profile in the
   profile entity store (in-memory, resets on reload — ADR-0005). */

import { useState } from "react";
import type { JSX } from "react";
import { AlertBanner, Button } from "@shared/ui";
import { isComposerAvailable, useComposerStatus } from "@entities/composer";
import {
  getActiveProfile,
  saveActiveProfile,
  toBiometrics,
  toBiometricsDraft,
  validateBiometrics,
} from "@entities/profile";
import type {
  BiometricFieldId,
  BiometricsDraft,
  ExperienceTierId,
  LifestyleProfile,
  OrthopedicLimitationId,
  UserProfile,
} from "@entities/profile";
import {
  buildGeneratePlanRequest,
  generatePlan,
  type GenerateProfilePatch,
  type TrainingGoalId,
  type TrainingPlan,
} from "@entities/training-plan";
import { HARDWARE_IDS } from "../config/hardware";
import { CAUTION_MAX_LENGTH } from "../config/limitations";
import { BiometricsForm } from "./BiometricsForm";
import { ExperienceTierSelect } from "./ExperienceTierSelect";
import { GoalSelect } from "./GoalSelect";
import { HardwareMap } from "./HardwareMap";
import { LifestyleRecovery } from "./LifestyleRecovery";
import { OrthopedicLimitations } from "./OrthopedicLimitations";
import { PayloadPreview } from "./PayloadPreview";

export interface OnboardingProps {
  /** Called with the validated generated plan after successful generate. */
  onGenerated: (plan: TrainingPlan) => void;
  /** Test-only profile override; production uses getActiveProfile(). */
  profile?: UserProfile;
}

const sectionStyle = {
  padding: "var(--sp-lg)",
  display: "grid",
  gap: "var(--sp-md)",
} as const;

const headingStyle = {
  margin: 0,
  color: "var(--text-high)",
} as const;

const pendingStyle = {
  margin: 0,
  color: "var(--accent-teal)",
} as const;

/**
 * Orchestrates onboarding required biometrics, experience tier and goal
 * selection, and plan generation.
 * @param props Success callback and optional profile override.
 * @returns Complete onboarding section.
 * @remarks Do not use when router navigation is required directly; keep that in the page.
 */
export function Onboarding(props: OnboardingProps): JSX.Element {
  // WHY: single effective-profile read feeds every initializer and the request;
  // the prop override (tests) beats the persisted/first-run entity profile.
  const effectiveProfile = props.profile ?? getActiveProfile();
  const [goals, setGoals] = useState<TrainingGoalId[]>([]);
  // WHY: seeded from the EFFECTIVE profile (override first) so a test/profile
  // with non-default lifestyle is respected; edits stay session-local.
  const [lifestyle, setLifestyle] = useState<LifestyleProfile>(() => ({
    ...effectiveProfile.lifestyle,
  }));
  // Same session-local seed model as lifestyle (plan A5): re-entering onboarding
  // re-seeds both fields from the EFFECTIVE profile so they stay editable.
  const [limitations, setLimitations] = useState<readonly OrthopedicLimitationId[]>(
    () => [...effectiveProfile.orthopedicLimitations],
  );
  const [caution, setCaution] = useState<string>(() => effectiveProfile.caution);
  // Required onboarding fields: seeded from the stored biometrics/tier so a
  // persisted profile re-opens complete (plan A5) and stays editable.
  const [biometricsDraft, setBiometricsDraft] = useState<BiometricsDraft>(() =>
    toBiometricsDraft(effectiveProfile.biometrics),
  );
  const [experienceTier, setExperienceTier] = useState<ExperienceTierId | null>(
    () => effectiveProfile.experienceTier,
  );
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");

  const biometricIssues = validateBiometrics(biometricsDraft);
  // null while the draft is incomplete — nulls are meaningful: the required
  // fields stay explicitly cleared in the payload until valid (plan A10).
  const biometrics = toBiometrics(biometricsDraft);
  const onboardingPatch: GenerateProfilePatch = { biometrics, experienceTier };
  const request = buildGeneratePlanRequest(
    effectiveProfile,
    goals,
    HARDWARE_IDS,
    lifestyle,
    { limitations, caution },
    onboardingPatch,
  );
  const profileReady = biometrics !== null && experienceTier !== null;
  const composerOffline = !isComposerAvailable(useComposerStatus());
  const generateDisabled =
    goals.length === 0 || !profileReady || status === "pending" || composerOffline;

  function handleToggle(id: TrainingGoalId): void {
    if (status === "pending") return;
    setGoals((current) =>
      current.includes(id)
        ? current.filter((goal) => goal !== id)
        : [...current, id],
    );
  }

  function handleBiometricChange(field: BiometricFieldId, raw: string): void {
    if (status === "pending") return; // same freeze rule as the other fields
    setBiometricsDraft((current) => ({ ...current, [field]: raw }));
  }

  function handleExperienceChange(next: ExperienceTierId): void {
    if (status === "pending") return;
    setExperienceTier(next);
  }

  function handleLifestyleChange(next: LifestyleProfile): void {
    if (status === "pending") return; // same freeze rule as goal chips
    setLifestyle(next);
  }

  function handleLimitationToggle(id: OrthopedicLimitationId): void {
    if (status === "pending") return;
    setLimitations((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function handleCautionChange(next: string): void {
    if (status === "pending") return;
    // WHY: native maxLength is UX; slicing also covers paste/programmatic input (plan A1).
    setCaution(next.slice(0, CAUTION_MAX_LENGTH));
  }

  async function handleGenerate(): Promise<void> {
    if (generateDisabled) return;
    setStatus("pending");
    try {
      // WHY: The same request object must feed preview and POST so they cannot drift.
      const plan = await generatePlan(request);
      // WHY: persist the exact profile that was sent — one source of truth, no
      // re-merge; before onGenerated so re-entry already seeds from it (plan A5).
      saveActiveProfile(request.profile);
      setStatus("idle");
      props.onGenerated(plan);
    } catch {
      setStatus("error");
    }
  }

  return (
    <section style={sectionStyle}>
      <h2 style={headingStyle}>Onboarding</h2>
      <BiometricsForm
        value={biometricsDraft}
        issues={biometricIssues}
        onChange={handleBiometricChange}
        disabled={status === "pending"}
      />
      <ExperienceTierSelect value={experienceTier} onChange={handleExperienceChange} />
      <GoalSelect selected={goals} onToggle={handleToggle} />
      <LifestyleRecovery value={lifestyle} onChange={handleLifestyleChange} />
      <OrthopedicLimitations
        limitations={limitations}
        caution={caution}
        onToggle={handleLimitationToggle}
        onCautionChange={handleCautionChange}
        disabled={status === "pending"}
      />
      <HardwareMap />
      <PayloadPreview request={request} />
      <Button
        disabled={generateDisabled}
        onClick={() => {
          void handleGenerate();
        }}
      >
        Generate
      </Button>
      {status === "pending" ? (
        <p role="status" style={pendingStyle}>
          Generating plan…
        </p>
      ) : null}
      {status === "error" ? (
        <AlertBanner message="Could not generate your plan. Please try again." />
      ) : null}
    </section>
  );
}
