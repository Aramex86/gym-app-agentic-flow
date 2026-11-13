/* features/training-history-search — main-page scenario ("/"). Owns the
   local query state ONLY: filtering logic lives in @entities/training-plan,
   the field is the shared SearchInput atom, the table stays the shared
   HistoryTable. No fetch, no submit handler, no URL/global state; the
   static sample needs no memoization or caching layer. */

import { useState } from "react";
import type { JSX } from "react";
import { HistoryTable, SearchInput } from "@shared/ui";
import {
  filterPlanWeeksByExerciseName,
  getTrainingPlan,
} from "@entities/training-plan";
import { SEARCH_FIELD } from "../config/search";

const wrapperStyle = {
  display: "grid",
  gap: "var(--sp-md)",
} as const;

export function TrainingHistorySearch(): JSX.Element {
  const [query, setQuery] = useState("");
  const weeks = getTrainingPlan().weeks;
  const visibleWeeks = filterPlanWeeksByExerciseName(weeks, query);

  return (
    <div style={wrapperStyle}>
      <SearchInput
        label={SEARCH_FIELD.label}
        placeholder={SEARCH_FIELD.placeholder}
        value={query}
        onValueChange={setQuery}
      />
      <HistoryTable weeks={visibleWeeks} />
    </div>
  );
}
