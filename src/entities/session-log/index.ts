/* entities/session-log — public API. Consumers import ONLY here
   (@entities/session-log), never deep entity paths. */

export type {
  LoggedSet,
  SessionLogEntry,
  PersonalRecord,
  PersonalRecordKind,
  SessionLogRow,
  ReviewPeriod,
  InsightSessionSummary,
  ReviewInsightRequest,
  ReviewInsight,
  TrackedExercise,
  WeeklyE1rmPoint,
  WeeklyVolumeBand,
  ExerciseFocus,
} from "./types";
export { REVIEW_PERIOD_DAYS, estimateOneRepMax, FOCUS_WEEKS, FOCUS_WINDOW_DAYS } from "./slice";
export { SESSION_LOG_SAMPLE } from "./sample";
export {
  selectSessionLogRows,
  selectSessionsNewestFirst,
  selectReviewPeriod,
  selectInsightSessionSummaries,
  selectTrackedExercises,
  selectExerciseFocus,
} from "./slice";
export {
  INSIGHT_ENDPOINT,
  INSIGHT_MODEL,
  InsightRequestError,
  getSessionLog,
  requestReviewInsight,
} from "./api";
export type { RequestReviewInsightInput } from "./api";
