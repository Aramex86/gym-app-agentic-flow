/* features/plan-recompose — main-plan scenario. Composition ONLY: the atom
   is the shared PromptInput, the send button the shared Button, data goes
   through @entities/training-plan (feature calls the entity API; NO fetch
   here — AGENTS.md data rule). Feature-local UI state only (instruction
   text + idle/pending/error status); the plan itself is page state passed
   via props. Imports: react, @entities/profile, @entities/training-plan,
   @shared/ui only. */

import { useState } from "react";
import type { JSX } from "react";
import { Button, PromptInput } from "@shared/ui";
import { getActiveProfile } from "@entities/profile";
import { recomposePlan } from "@entities/training-plan";
import type { TrainingPlan } from "@entities/training-plan";
import type { UserProfile } from "@entities/profile";

export interface PlanRecomposeProps {
  /** The plan currently visible on the screen; sent to the composer. */
  plan: TrainingPlan;
  /** Receives the validated plan returned by the composer. */
  onPlanChange: (plan: TrainingPlan) => void;
  /** Test-only override; production reads getActiveProfile(). */
  profile?: UserProfile;
}

const wrapperStyle = {
  display: "grid",
  gap: "var(--sp-sm)",
  padding: "var(--sp-md)",
  background: "var(--surface)",
  border: "1px solid var(--edge)",
  borderRadius: "var(--r-card)",
} as const;

const pendingStyle = {
  margin: 0,
  color: "var(--accent-teal)",
} as const;

const errorStyle = {
  margin: 0,
  color: "var(--accent-amber)",
} as const;

export function PlanRecompose(props: PlanRecomposeProps): JSX.Element {
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const sendDisabled = status === "pending" || instruction.trim().length === 0;

  async function handleSend(): Promise<void> {
    const trimmed = instruction.trim();
    // WHY: plan A4 + A6 — whitespace input sends nothing; one request per
    // send click, no queue (early return while pending; button also disabled).
    if (trimmed.length === 0 || status === "pending") return;
    setStatus("pending");
    try {
      const nextPlan = await recomposePlan({
        profile: props.profile ?? getActiveProfile(),
        plan: props.plan,
        instruction: trimmed,
      });
      props.onPlanChange(nextPlan);
      // Plan A5 — instruction is kept so the user can iterate; the error
      // text clears when the next send succeeds.
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={wrapperStyle}>
      <PromptInput
        label="Re-compose instruction"
        placeholder="e.g. Add a deload week and reduce volume"
        value={instruction}
        onValueChange={setInstruction}
        disabled={status === "pending"}
      />
      <Button
        onClick={() => {
          void handleSend();
        }}
        disabled={sendDisabled}
      >
        Send
      </Button>
      {status === "pending" && (
        <p role="status" style={pendingStyle}>
          Re-composing plan…
        </p>
      )}
      {status === "error" && (
        <p role="alert" style={errorStyle}>
          Could not re-compose the plan. Please try again.
        </p>
      )}
    </div>
  );
}
