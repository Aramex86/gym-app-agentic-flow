import { describe, expect, it } from 'vitest';
import { isPlan, validatePlan } from '../plan.schema';
import { SAMPLE_PLAN } from '../plan.sample';

const DISCLAIMER =
  'This plan is for informational purposes only and is not medical advice. Consult a qualified professional before starting any training program.';

function firstPath(value: unknown): string {
  const issues = validatePlan(value);
  expect(issues.length).toBeGreaterThanOrEqual(1);
  return issues[0].path;
}

describe('shared/config plan contract v0.1', () => {
  it('SAMPLE_PLAN satisfies the contract (R1-R9, empty issues)', () => {
    expect(validatePlan(SAMPLE_PLAN)).toEqual([]);
  });

  it('isPlan accepts the sample', () => {
    expect(isPlan(SAMPLE_PLAN)).toBe(true);
  });

  it('has the 4 weeks x 2 day-splits x 5 exercises structure', () => {
    expect(SAMPLE_PLAN.weeks.length).toBe(4);
    for (const week of SAMPLE_PLAN.weeks) {
      expect(week.days.length).toBe(2);
      for (const day of week.days) {
        expect(day.exercises.length).toBe(5);
        for (const exercise of day.exercises) {
          expect(typeof exercise.sets).toBe('number');
          expect(typeof exercise.reps).toBe('number');
          expect(typeof exercise.rpe).toBe('number');
          expect(typeof exercise.restSec).toBe('number');
        }
      }
    }
  });

  it('week and day ordinals are 1-based contiguous', () => {
    expect(SAMPLE_PLAN.weeks.map((week) => week.week)).toEqual([1, 2, 3, 4]);
    for (const week of SAMPLE_PLAN.weeks) {
      expect(week.days.map((day) => day.day)).toEqual([1, 2]);
    }
  });

  it('exercise ids are unique across the whole plan', () => {
    const ids = SAMPLE_PLAN.weeks.flatMap((week) =>
      week.days.flatMap((day) => day.exercises.map((exercise) => exercise.id)),
    );
    expect(ids.length).toBe(40);
    expect(new Set(ids).size).toBe(40);
  });

  it('exercise numbers stay in contract bounds', () => {
    for (const week of SAMPLE_PLAN.weeks) {
      for (const day of week.days) {
        for (const exercise of day.exercises) {
          expect(exercise.sets).toBeGreaterThanOrEqual(1);
          expect(exercise.sets).toBeLessThanOrEqual(20);
          expect(Number.isInteger(exercise.sets)).toBe(true);
          expect(exercise.reps).toBeGreaterThanOrEqual(1);
          expect(exercise.reps).toBeLessThanOrEqual(50);
          expect(Number.isInteger(exercise.reps)).toBe(true);
          expect(exercise.rpe).toBeGreaterThanOrEqual(1);
          expect(exercise.rpe).toBeLessThanOrEqual(10);
          expect((exercise.rpe * 2) % 1).toBe(0);
          expect(exercise.restSec).toBeGreaterThanOrEqual(15);
          expect(exercise.restSec).toBeLessThanOrEqual(600);
          expect(Number.isInteger(exercise.restSec)).toBe(true);
        }
      }
    }
  });

  it('renders the disclaimer verbatim (D4)', () => {
    expect(SAMPLE_PLAN.disclaimer).toBe(DISCLAIMER);
  });

  it('pins schemaVersion and level', () => {
    expect(SAMPLE_PLAN.schemaVersion).toBe('0.1');
    expect(SAMPLE_PLAN.level).toBe('intermediate');
  });

  it('rejects an unknown top-level key (R2)', () => {
    expect(firstPath({ ...SAMPLE_PLAN, commentary: 'early comment' })).toBe('commentary');
  });

  it('rejects a wrong schemaVersion (R3)', () => {
    const issues = validatePlan({ ...SAMPLE_PLAN, schemaVersion: '0.2' });
    expect(issues.some((issue) => issue.path === 'schemaVersion')).toBe(true);
  });

  it('rejects an unknown level (R5)', () => {
    const issues = validatePlan({ ...SAMPLE_PLAN, level: 'elite' });
    expect(issues.some((issue) => issue.path === 'level')).toBe(true);
  });

  it('rejects sets out of range (R9)', () => {
    const base = SAMPLE_PLAN.weeks[0].days[0].exercises[0];
    const issues = validatePlan({
      ...SAMPLE_PLAN,
      weeks: [
        {
          ...SAMPLE_PLAN.weeks[0],
          days: [
            {
              ...SAMPLE_PLAN.weeks[0].days[0],
              exercises: [{ ...base, sets: 0 }, ...SAMPLE_PLAN.weeks[0].days[0].exercises.slice(1)],
            },
            SAMPLE_PLAN.weeks[0].days[1],
          ],
        },
        ...SAMPLE_PLAN.weeks.slice(1),
      ],
    });
    expect(issues.some((issue) => issue.path === 'weeks[0].days[0].exercises[0].sets')).toBe(true);
  });

  it('rejects an rpe off the 0.5 grid (R9)', () => {
    const base = { ...SAMPLE_PLAN.weeks[0].days[0].exercises[0], rpe: 7.3 };
    const exercises = [base, ...SAMPLE_PLAN.weeks[0].days[0].exercises.slice(1)];
    const issues = validatePlan({
      ...SAMPLE_PLAN,
      weeks: [
        { ...SAMPLE_PLAN.weeks[0], days: [{ ...SAMPLE_PLAN.weeks[0].days[0], exercises }, SAMPLE_PLAN.weeks[0].days[1]] },
        ...SAMPLE_PLAN.weeks.slice(1),
      ],
    });
    expect(issues.some((issue) => issue.path === 'weeks[0].days[0].exercises[0].rpe')).toBe(true);
  });

  it('rejects restSec above the maximum (R9)', () => {
    const base = { ...SAMPLE_PLAN.weeks[0].days[1].exercises[0], restSec: 900 };
    const exercises = [base, ...SAMPLE_PLAN.weeks[0].days[1].exercises.slice(1)];
    const issues = validatePlan({
      ...SAMPLE_PLAN,
      weeks: [
        { ...SAMPLE_PLAN.weeks[0], days: [SAMPLE_PLAN.weeks[0].days[0], { ...SAMPLE_PLAN.weeks[0].days[1], exercises }] },
        ...SAMPLE_PLAN.weeks.slice(1),
      ],
    });
    expect(issues.some((issue) => issue.path === 'weeks[0].days[1].exercises[0].restSec')).toBe(true);
  });

  it('rejects a duplicated exercise id (R9)', () => {
    const base = SAMPLE_PLAN.weeks[0].days[0].exercises[0];
    const exercises = [base, { ...SAMPLE_PLAN.weeks[0].days[0].exercises[1], id: base.id }];
    const issues = validatePlan({
      ...SAMPLE_PLAN,
      weeks: [
        { ...SAMPLE_PLAN.weeks[0], days: [{ ...SAMPLE_PLAN.weeks[0].days[0], exercises }, SAMPLE_PLAN.weeks[0].days[1]] },
        ...SAMPLE_PLAN.weeks.slice(1),
      ],
    });
    expect(issues.some((issue) => issue.path === 'weeks[0].days[0].exercises[1].id')).toBe(true);
  });

  it('rejects non-contiguous week numbers (R6)', () => {
    const issues = validatePlan({
      ...SAMPLE_PLAN,
      weeks: [{ ...SAMPLE_PLAN.weeks[1], week: 2 }, SAMPLE_PLAN.weeks[1], SAMPLE_PLAN.weeks[2], SAMPLE_PLAN.weeks[3]],
    });
    expect(issues.some((issue) => issue.path === 'weeks[0].week')).toBe(true);
  });

  it('rejects an empty disclaimer (R4)', () => {
    const issues = validatePlan({ ...SAMPLE_PLAN, disclaimer: '' });
    expect(issues.some((issue) => issue.path === 'disclaimer')).toBe(true);
  });
});
