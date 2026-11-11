/* shared/config — plan contract v0.1. Types mirror docs/contracts/plan-schema.md.
   Single source of truth for the FE; the backend/composer mirror the same doc. */

export const PLAN_SCHEMA_VERSION = '0.1';

export type PlanLevel = 'beginner' | 'intermediate' | 'advanced';

export interface PlanExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  rpe: number;
  restSec: number;
}

export interface PlanDay {
  day: number;
  split: string;
  exercises: PlanExercise[];
}

export interface PlanWeek {
  week: number;
  focus: string;
  days: PlanDay[];
}

export interface TrainingPlan {
  schemaVersion: '0.1';
  planId: string;
  title: string;
  goal: string;
  level: PlanLevel;
  weeks: PlanWeek[];
  disclaimer: string;
}

export interface PlanValidationIssue {
  path: string;
  message: string;
}

const PLAN_ROOT_KEYS: readonly string[] = [
  'schemaVersion',
  'planId',
  'title',
  'goal',
  'level',
  'weeks',
  'disclaimer',
];

const PLAN_LEVELS: readonly PlanLevel[] = ['beginner', 'intermediate', 'advanced'];

function addNonEmptyString(
  issues: PlanValidationIssue[],
  path: string,
  value: unknown,
  label: string,
): void {
  if (typeof value !== 'string' || value.length === 0) {
    issues.push({ path, message: `${label} must be a non-empty string` });
  }
}

function addIntegerInRange(
  issues: PlanValidationIssue[],
  path: string,
  value: unknown,
  min: number,
  max: number,
  label: string,
): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    issues.push({ path, message: `${label} must be an integer between ${min} and ${max}` });
  }
}

function addContiguous(
  issues: PlanValidationIssue[],
  path: string,
  value: unknown,
  expected: number,
  label: string,
): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value !== expected) {
    issues.push({
      path,
      message: `${label} numbers must be 1-based contiguous; expected ${expected}`,
    });
  }
}

function validateExercise(
  exercise: unknown,
  path: string,
  issues: PlanValidationIssue[],
  seenIds: Set<string>,
): void {
  if (typeof exercise !== 'object' || exercise === null || Array.isArray(exercise)) {
    issues.push({ path, message: 'exercise must be a plain object' });
    return;
  }
  const candidate = exercise as Record<string, unknown>;
  const id = candidate.id;
  addNonEmptyString(issues, `${path}.id`, id, 'exercise id');
  if (typeof id === 'string' && id.length > 0) {
    if (seenIds.has(id)) {
      issues.push({ path: `${path}.id`, message: `duplicate exercise id "${id}"` });
    }
    seenIds.add(id);
  }
  addNonEmptyString(issues, `${path}.name`, candidate.name, 'exercise name');
  addIntegerInRange(issues, `${path}.sets`, candidate.sets, 1, 20, 'exercise sets');
  addIntegerInRange(issues, `${path}.reps`, candidate.reps, 1, 50, 'exercise reps');

  const rpe = candidate.rpe;
  if (
    typeof rpe !== 'number' ||
    !Number.isFinite(rpe) ||
    rpe < 1 ||
    rpe > 10 ||
    (rpe * 2) % 1 !== 0
  ) {
    issues.push({ path: `${path}.rpe`, message: 'exercise rpe must be 1-10 in 0.5 steps' });
  }

  addIntegerInRange(issues, `${path}.restSec`, candidate.restSec, 15, 600, 'exercise restSec');
}

function validateDay(
  day: unknown,
  path: string,
  dayIndex: number,
  issues: PlanValidationIssue[],
  seenIds: Set<string>,
): void {
  if (typeof day !== 'object' || day === null || Array.isArray(day)) {
    issues.push({ path, message: 'plan day must be a plain object' });
    return;
  }
  const candidate = day as Record<string, unknown>;
  addNonEmptyString(issues, `${path}.split`, candidate.split, 'plan day split');
  addContiguous(issues, `${path}.day`, candidate.day, dayIndex + 1, 'day');
  if (!Array.isArray(candidate.exercises) || candidate.exercises.length < 1) {
    issues.push({
      path: `${path}.exercises`,
      message: 'plan day exercises must be an array with at least 1 exercise',
    });
    return;
  }
  candidate.exercises.forEach((exercise, exerciseIndex) => {
    validateExercise(exercise, `${path}.exercises[${exerciseIndex}]`, issues, seenIds);
  });
}

function validateWeek(
  week: unknown,
  path: string,
  weekIndex: number,
  issues: PlanValidationIssue[],
  seenIds: Set<string>,
): void {
  if (typeof week !== 'object' || week === null || Array.isArray(week)) {
    issues.push({ path, message: 'plan week must be a plain object' });
    return;
  }
  const candidate = week as Record<string, unknown>;
  addNonEmptyString(issues, `${path}.focus`, candidate.focus, 'plan week focus');
  addContiguous(issues, `${path}.week`, candidate.week, weekIndex + 1, 'week');
  if (!Array.isArray(candidate.days) || candidate.days.length < 1) {
    issues.push({
      path: `${path}.days`,
      message: 'plan week days must be an array with at least 1 day',
    });
    return;
  }
  candidate.days.forEach((day, dayIndex) => {
    validateDay(day, `${path}.days[${dayIndex}]`, dayIndex, issues, seenIds);
  });
}

/** Validates an unknown value against plan contract v0.1 (rules R1-R9). */
export function validatePlan(value: unknown): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = [];

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issues.push({ path: '', message: 'plan must be a plain object' });
    return issues;
  }

  const root = value as Record<string, unknown>;
  for (const key of Object.keys(root)) {
    if (!PLAN_ROOT_KEYS.includes(key)) {
      issues.push({ path: key, message: `unknown top-level key "${key}"` });
    }
  }

  if (root.schemaVersion !== PLAN_SCHEMA_VERSION) {
    issues.push({
      path: 'schemaVersion',
      message: `schemaVersion must be "${PLAN_SCHEMA_VERSION}"`,
    });
  }
  if (typeof root.planId !== 'string' || !/^[a-z0-9-]+$/.test(root.planId)) {
    issues.push({ path: 'planId', message: 'planId must be non-empty and match /^[a-z0-9-]+$/' });
  }
  addNonEmptyString(issues, 'title', root.title, 'title');
  addNonEmptyString(issues, 'goal', root.goal, 'goal');
  addNonEmptyString(issues, 'disclaimer', root.disclaimer, 'disclaimer');
  if (typeof root.level !== 'string' || !PLAN_LEVELS.includes(root.level as PlanLevel)) {
    issues.push({ path: 'level', message: `level must be one of ${PLAN_LEVELS.join(' | ')}` });
  }
  if (!Array.isArray(root.weeks) || root.weeks.length < 1) {
    issues.push({ path: 'weeks', message: 'weeks must be an array with at least 1 week' });
    return issues;
  }

  const seenIds = new Set<string>();
  root.weeks.forEach((week, weekIndex) => {
    validateWeek(week, `weeks[${weekIndex}]`, weekIndex, issues, seenIds);
  });
  return issues;
}

/** Type guard convenience over validatePlan. */
export function isPlan(value: unknown): value is TrainingPlan {
  return validatePlan(value).length === 0;
}
