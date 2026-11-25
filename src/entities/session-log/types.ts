/* entities/session-log — cross-feature data model for the logged training
   sessions, their derived personal records and the AI review insight wire
   shapes. Layer reason: shared by @features/progress-history (log + PR
   badges) and @features/progress-insight (review card) through this entity,
   so the two features never import each other (AGENTS.md FSAA). */

/** One logged set entry inside a session (the PR unit of measurement). */
export interface LoggedSet {
  /** Matches the PlanExercise.id family; also the PR comparison key. */
  exerciseId: string;
  exerciseName: string;
  /** Kilograms moved; > 0. */
  weightKg: number;
  /** Reps of one set; >= 1. */
  reps: number;
  /** How many sets of this weight x reps were performed; >= 1. */
  sets: number;
}

/** A completed training session in the log. */
export interface SessionLogEntry {
  /** Stable id, e.g. "s-2026-11-19-lower". */
  id: string;
  /** ISO YYYY-MM-DD; the chronology key (lexicographically sortable). */
  date: string;
  /** Split name, e.g. "Upper" | "Lower" today. */
  split: string;
  durationMin: number;
  sets: LoggedSet[];
}

export type PersonalRecordKind = "estimated-1rm";

/** A strictly higher estimated 1RM than the previous best for an exercise. */
export interface PersonalRecord {
  kind: PersonalRecordKind;
  exerciseId: string;
  exerciseName: string;
  /** New best e1RM, 1 decimal. */
  valueKg: number;
  /** Previous best e1RM, 1 decimal. */
  previousKg: number;
}

/** A log entry enriched with its derived records (empty when no PR). */
export interface SessionLogRow extends SessionLogEntry {
  records: PersonalRecord[]; // derived; empty when no PR
}

/** One review period window over the log. */
export interface ReviewPeriod {
  /** e.g. "last-4-weeks". */
  id: string;
  /** ISO date, inclusive. */
  from: string;
  /** ISO date, inclusive. */
  to: string;
  /** Human label, e.g. "Last 4 weeks". */
  label: string;
}

/** Compact per-session payload sent to the gym-gate with an insight request. */
export interface InsightSessionSummary {
  id: string;
  date: string;
  split: string;
  prCount: number;
}

/** Body of POST /api/progress/insight (docs/contracts/progress-insight.md). */
export interface ReviewInsightRequest {
  /** Model id the gym-gate routes, e.g. "kimi-k3.1" — never called directly. */
  model: string;
  period: ReviewPeriod;
  sessions: InsightSessionSummary[];
}

/** 2xx body of POST /api/progress/insight (docs/contracts/progress-insight.md). */
export interface ReviewInsight {
  /** Must equal the requested period.id. */
  periodId: string;
  /** Must be a non-empty string. */
  model: string;
  /** Non-empty prose for the review period. */
  insight: string;
}
