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

/** One exercise logged inside the exercise-focus window (selector option). */
export interface TrackedExercise {
  /** The PR comparison key (LoggedSet.exerciseId family). */
  exerciseId: string;
  /** Display name from the first ascending-order sighting. */
  exerciseName: string;
}

/** One populated weekly bucket of an exercise's e1RM trajectory. */
export interface WeeklyE1rmPoint {
  /** ISO YYYY-MM-DD: the bucket start (period.from + 7 * bucketIndex). */
  weekStart: string;
  /** Best Epley e1RM in the bucket, 1 decimal kg. */
  valueKg: number;
  /** Sessions in the bucket containing the exercise; >= 1. */
  sessionCount: number;
}

/** One populated weekly bucket of per-session tonnage dispersion. */
export interface WeeklyVolumeBand {
  /** ISO YYYY-MM-DD: the bucket start. */
  weekStart: string;
  /** Lowest per-session tonnage in the bucket, 1 decimal kg. */
  minVolumeKg: number;
  /** Highest per-session tonnage in the bucket, 1 decimal kg. */
  maxVolumeKg: number;
  /** Mean per-session tonnage in the bucket, 1 decimal kg. */
  meanVolumeKg: number;
  /** Sessions in the bucket containing the exercise; >= 1. */
  sessionCount: number;
}

/** Everything the exercise-focus charts derive for one exercise. Only
    POPULATED buckets are emitted (no synthetic, interpolated or filled
    forward points — task plan §1); empty weeks simply stay absent. */
export interface ExerciseFocus {
  exerciseId: string;
  exerciseName: string;
  /** Fixed window length in weekly buckets (4). */
  weekCount: number;
  /** Populated buckets only, ascending; length 1..weekCount. */
  e1rmPoints: WeeklyE1rmPoint[];
  /** Populated buckets only, ascending; same weekStart set as e1rmPoints. */
  volumeBands: WeeklyVolumeBand[];
  /** Best e1RM of the 7 days immediately BEFORE the window: the
      trajectory's base anchor (the chart's first x tick). Absent when that
      week has no session — no synthetic anchor, no filled gap. */
  baseAnchor?: WeeklyE1rmPoint;
}
