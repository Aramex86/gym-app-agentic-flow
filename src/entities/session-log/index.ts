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
} from "./types";
export { REVIEW_PERIOD_DAYS, estimateOneRepMax } from "./slice";
export { SESSION_LOG_SAMPLE } from "./sample";
export {
  selectSessionLogRows,
  selectSessionsNewestFirst,
  selectReviewPeriod,
  selectInsightSessionSummaries,
} from "./slice";
export {
  INSIGHT_ENDPOINT,
  INSIGHT_MODEL,
  InsightRequestError,
  getSessionLog,
  requestReviewInsight,
} from "./api";
export type { RequestReviewInsightInput } from "./api";
