import { HistoryTable } from "@shared/ui";
import { SAMPLE_PLAN } from "@shared/config/plan.sample";

/* Thin page composition (FSAA pages layer): import -> render.
   No fetch, no state — data is the static SAMPLE_PLAN, rendered by the
   shared HistoryTable (same data the Progress page renders). */

export function HomePage() {
  return (
    <section style={{ padding: "var(--sp-lg)", display: "grid", gap: "var(--sp-lg)" }}>
      <h2 style={{ margin: 0, color: "var(--text-high)" }}>Home</h2>
      <HistoryTable weeks={SAMPLE_PLAN.weeks} />
    </section>
  );
}
