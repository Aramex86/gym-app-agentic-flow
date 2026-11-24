/* features/onboarding/ui/Onboarding — onboarding scenario root.
   Layer reason: feature-level state orchestration for goals, payload preview, and generate CTA. */

import { useState } from "react";
import type { JSX } from "react";
import { AlertBanner, Button } from "@shared/ui";
import { isComposerAvailable, useComposerStatus } from "@entities/composer";
import { getActiveProfile } from "@entities/profile";
import {
  buildGeneratePlanRequest,
  generatePlan,
  type TrainingGoalId,
  type TrainingPlan,
} from "@entities/training-plan";
import type {
  LifestyleProfile,
  OrthopedicLimitationId,
  UserProfile,
} from "@entities/profile";
import { HARDWARE_IDS } from "../config/hardware";
import { CAUTION_MAX_LENGTH } from "../config/limitations";
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
 * Orchestrates onboarding goal selection and plan generation.
 * @param props Success callback and optional profile override.
 * @returns Complete onboarding section.
 * @remarks Do not use when router navigation is required directly; keep that in the page.
 */
export function Onboarding(props: OnboardingProps): JSX.Element {
  const [goals, setGoals] = useState<TrainingGoalId[]>([]);
  // WHY: seeded from the EFFECTIVE profile (override first) so a test/profile
  // with non-default lifestyle is respected; edits stay session-local.
  const [lifestyle, setLifestyle] = useState<LifestyleProfile>(() => ({
    ...(props.profile ?? getActiveProfile()).lifestyle,
  }));
  // Same session-local seed model as lifestyle (plan A5): re-entering onboarding
  // re-seeds both fields from the EFFECTIVE profile so they stay editable.
  const [limitations, setLimitations] = useState<readonly OrthopedicLimitationId[]>(
    () => [...(props.profile ?? getActiveProfile()).orthopedicLimitations],
  );
  const [caution, setCaution] = useState<string>(
    () => (props.profile ?? getActiveProfile()).caution,
  );
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");

  const request = buildGeneratePlanRequest(
    props.profile ?? getActiveProfile(),
    goals,
    HARDWARE_IDS,
    lifestyle,
    { limitations, caution },
  );
  const composerOffline = !isComposerAvailable(useComposerStatus());
  const generateDisabled = goals.length === 0 || status === "pending" || composerOffline;

  function handleToggle(id: TrainingGoalId): void {
    if (status === "pending") return;
    setGoals((current) =>
      current.includes(id)
        ? current.filter((goal) => goal !== id)
        : [...current, id],
    );
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
      setStatus("idle");
      props.onGenerated(plan);
    } catch {
      setStatus("error");
    }
  }

  return (
    <section style={sectionStyle}>
      <h2 style={headingStyle}>Onboarding</h2>
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
