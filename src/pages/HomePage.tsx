import { TrainingHistorySearch } from "@features/training-history-search";

/* Thin page composition (FSAA pages layer): import -> render.
   No fetch, no state, no query logic — the search scenario lives in the
   training-history-search feature, which composes the shared SearchInput
   atom and HistoryTable over the entity-provided static plan. */

export function HomePage() {
  return (
    <section style={{ padding: "var(--sp-lg)", display: "grid", gap: "var(--sp-lg)" }}>
      <h2 style={{ margin: 0, color: "var(--text-high)" }}>Home</h2>
      <TrainingHistorySearch />
    </section>
  );
}
