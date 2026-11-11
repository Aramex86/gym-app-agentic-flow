# Plan — Plan JSON contract (v0.1)

**Task:** `tasks/2026-11-10-plan-contract.md`
**Plan id:** `2026-11-10-plan-contract`
**Branch:** `feat/addRoles` (plan written here; **do not** commit to `main`, AGENTS.md "Git & PR")
**Layer touched:** `src/shared/config/` (lowest layer) + `docs/contracts/`
**Role:** Planner → human gate (Y/N) → Developer → Tester

---

## 1. Goal

One data contract that the SPA renderer, the gym-gate backend and the kimi-k3.1
composer all agree on, plus a static sample so UI work can start without a live
LLM call.

Deliverables:

| # | Artifact | Purpose |
|---|---|---|
| 1 | `docs/contracts/plan-schema.md` | Normative prose contract: object shape, field names, units, validation rules |
| 2 | `src/shared/config/plan.schema.ts` | TypeScript mirror of the contract — single source of truth for the FE |
| 3 | `src/shared/config/plan.sample.ts` | Static sample plan (4 weeks × 2 day-splits × 5 exercises) that satisfies the contract |
| 4 | `src/shared/config/__tests__/plan.test.ts` | Executable proof that the sample satisfies every validation rule (same commit) |

Non-goals (explicitly **not** in this task): no page/route/feature UI, no entity,
no API call, no runtime validator library, no JSON Schema file, no backend code.

---

## 2. Affected FSAA layers / files

**New files only. Nothing existing is modified.**

```
docs/contracts/plan-schema.md                     ← new (contract prose)
src/shared/config/plan.schema.ts                  ← new (types + validator)
src/shared/config/plan.sample.ts                  ← new (static sample)
src/shared/config/__tests__/plan.test.ts          ← new (tests, same commit)
```

**Not touched:** `src/app/`, `src/pages/`, `src/features/`, `src/entities/`,
`src/shared/ui/`, `eslint.config.mjs`, `vite.config.ts`, `index.html`,
`package.json`, `pnpm-lock.yaml`, **and `AGENTS.md`** (see Risk R4 — drift-check
two-way binding makes an added `<!--check:-->` marker a CI failure unless
`scripts/check-agents-md.mjs` grows a matching check).

**Layer justification.** `src/shared/` is the bottom layer, so `entities`,
`features` and `pages` may all import `@shared/config/plan.schema` without
breaking the "imports flow only downward" rule (`eslint.config.mjs`,
`fsaa/boundary-imports`). The file lives next to `site.ts` / `theme.ts` and is
imported the same way — `@shared/config/plan.schema` (no barrel file; the
repo has no `src/shared/config/index.ts` and does not need one).

---

## 3. Assumptions (human gate confirms these)

The task file leaves four things open. Each is resolved below with the choice
the Developer must implement — **do not re-decide these in the implementation**.

**A1 — "matching Stitch screens' content exactly" cannot be verified from this repo.**
The Stitch project assets are not vendored here; the only trace is the id
`stitch project 6928097282469008044 / kinetic_obsidian/` in
`src/shared/ui/tokens.css:2`. The plan therefore **fixes the sample content
normatively** (§6), so the criterion becomes checkable. *Gate question:* is
the exercise table in §6 the agreed mirror of the Stitch screens, or does the
Stitch content need a different pass? If different, **update §6 in this plan
before the Developer starts** — the Developer must not invent exercises.

**A2 — `rest` is named `restSec` (unit in the name).**
The task lists "sets/reps/rpe/rest" and separately requires the contract to
define *units*. A bare `rest` leaves "seconds or minutes?" open across three
consumers, so the field is `restSec`, always **integer seconds**.

**A3 — `reps` is a number, not a range string.**
`"8-12"` cannot be validated or aggregated without parsing; v0.1 uses a single
target integer per set (`reps: number`). A range (e.g. `repsMin`/`repsMax`) is
a later-card concern, not this one.

**A4 — v0.1 is a *closed* top-level key set.**
The task says the AI-commentary object "comes in a later card". If the FE
silently ignored unknown top-level keys, a composer could ship `commentary`
early and the FE would render a plan missing it. So the validator **rejects
unknown top-level keys**; widening is an explicit version bump.

---

## 4. The contract, normatively

### 4.1 Top level

`TrainingPlan` — exactly these 7 keys, no more, no less (R2):

| Field | Type | Unit / domain | Required | Notes |
|---|---|---|---|---|
| `schemaVersion` | literal string `"0.1"` | — | yes | Contract version, not the app version |
| `planId` | string | non-empty, `[a-z0-9-]+` | yes | Stable id, kebab-case |
| `title` | string | non-empty | yes | Human-facing title |
| `goal` | string | non-empty | yes | Free text, composer-owned (`"Strength & hypertrophy"`) |
| `level` | union | `"beginner" \| "intermediate" \| "advanced"` | yes | Closed enum |
| `weeks` | `PlanWeek[]` | length ≥ 1 | yes | Sample has 4 |
| `disclaimer` | string | non-empty | yes | **Fixed key (D4)** — UI renders it **verbatim**, no parsing, no truncation |

### 4.2 Nested

`PlanWeek`: `week: number` (1-based, contiguous) · `focus: string` (non-empty, e.g. `"Base Volume"`) · `days: PlanDay[]` (≥1; sample has 2)

`PlanDay`: `day: number` (1-based **within the week**, contiguous) · `split: string` (non-empty, day-split label, e.g. `"Upper"`) · `exercises: PlanExercise[]` (≥1; sample has 5)

`PlanExercise`:

| Field | Type | Unit / range | Notes |
|---|---|---|---|
| `id` | string | non-empty, **globally unique in the plan** | React key + backend reference |
| `name` | string | non-empty | Display name |
| `sets` | number | integer, 1–20 | Count of working sets |
| `reps` | number | integer, 1–50 | Target reps **per set** |
| `rpe` | number | 1–10, **0.5 steps** (value × 2 is an integer) | Rate of Perceived Exertion, unitless |
| `restSec` | number | integer, 15–600 | **Seconds** of rest between sets |

### 4.3 Validation rules (R1–R9) — implemented in `validatePlan`

| Id | Rule |
|---|---|
| R1 | Root value is a plain object |
| R2 | Top-level key set is exactly `{schemaVersion, planId, title, goal, level, weeks, disclaimer}` — unknown keys are an error |
| R3 | `schemaVersion === "0.1"` |
| R4 | `planId` non-empty and matches `/^[a-z0-9-]+$/`; `title`, `goal`, `disclaimer` are non-empty strings |
| R5 | `level` ∈ {beginner, intermediate, advanced} |
| R6 | `weeks` is an array of length ≥ 1; `week` numbers are 1-based and contiguous ascending |
| R7 | Each week: `focus` non-empty; `days` array length ≥ 1; `day` numbers 1-based and contiguous ascending **within the week**; `split` non-empty |
| R8 | Each day: `exercises` array length ≥ 1 |
| R9 | Each exercise: `id` non-empty and **unique across the whole plan**; `name` non-empty; `sets` integer 1–20; `reps` integer 1–50; `rpe` in 1–10 with `(rpe * 2) % 1 === 0`; `restSec` integer 15–600 |

All violations are **collected**, not thrown one at a time: `validatePlan`
returns an array of issues, each with a JSON-path-ish `path` (`"weeks[0].days[1].exercises[2].sets"`)
and a `message`.

---

## 5. Step-by-step changes

### Step 1 — `src/shared/config/plan.schema.ts` (new)

Types + validator. **Zero dependencies** (no `zod` — a new dep would churn
`pnpm-lock.yaml`, which this task should not touch).

```ts
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

/** Validates an unknown value against plan contract v0.1 (rules R1–R9). */
export function validatePlan(value: unknown): PlanValidationIssue[];

/** Type guard convenience over validatePlan. */
export function isPlan(value: unknown): value is TrainingPlan;
```

Implementation notes for the Developer:
- `validatePlan` takes `unknown` and narrows locally (`typeof`, `Array.isArray`);
  it must not `throw` on bad input — it returns issues.
- Use one helper for "non-empty string" and one for "integer in range" so the
  rule ids stay consistent across the three nesting levels.
- `isPlan` = `validatePlan(value).length === 0`.
- `PLAN_SCHEMA_VERSION` is exported so the sample and the doc cannot drift from
  the literal `"0.1"` typed in `TrainingPlan`.

### Step 2 — `src/shared/config/plan.sample.ts` (new)

```ts
import type { TrainingPlan } from './plan.schema';

export const SAMPLE_PLAN = { /* §6 content, verbatim */ } satisfies TrainingPlan;
```

- Use `satisfies TrainingPlan` (TS 5 is in `devDependencies`). It type-checks the
  sample against the contract **without** widening `schemaVersion` away from the
  literal `"0.1"`, and it keeps the literal shape for tests. If the Developer
  hits a `satisfies`/`as const` friction, fall back to
  `export const SAMPLE_PLAN: TrainingPlan = { ... }` — same guarantee, less
  inference. Either is acceptable; do **not** use `as const` alone (it makes
  the arrays `readonly` and breaks assignability to `TrainingPlan`).
- **No colors, no hex, no design values** in this file — it is data only
  (ADR-0001 D5 token rule is not triggered because no styling is involved).
- Fixed root values (exact strings, asserted by the test):
  - `schemaVersion`: `"0.1"`
  - `planId`: `"sample-4w-upper-lower"`
  - `title`: `"Sample Hypertrophy Block — 4 Weeks"`
  - `goal`: `"Strength & hypertrophy"`
  - `level`: `"intermediate"`
  - `disclaimer`: `"This plan is for informational purposes only and is not medical advice. Consult a qualified professional before starting any training program."`
    — rendered **verbatim** by the UI (D4), no markup, no trailing whitespace.

### Step 3 — `src/shared/config/__tests__/plan.test.ts` (new)

Follow the existing test convention (`src/entities/project/__tests__/project.test.ts`):
explicit `import { describe, expect, it } from 'vitest'` — **no globals**
(`tsconfig.json` sets `types: ["vite/client"]` only).

Import the two modules **relatively** (`../plan.schema`, `../plan.sample`), like
the entity tests do (`../index`) — this matches the existing convention and
sidesteps any alias-resolution difference between the Vite build and the test
runner. `tsconfig.json` includes `src`, so this test file is type-checked by
`pnpm typecheck` too — it must compile clean.

Test cases (this list is the Developer's spec and the Tester's checklist):

1. `validatePlan(SAMPLE_PLAN)` returns `[]` (empty array) — the sample satisfies R1–R9.
2. `isPlan(SAMPLE_PLAN)` is `true`.
3. Structure: `SAMPLE_PLAN.weeks.length === 4`; every week has `days.length === 2`;
   every day has `exercises.length === 5`; every exercise has `sets`, `reps`,
   `rpe`, `restSec` all of type `number`.
4. Week numbers are 1..4 contiguous; each week's day numbers are 1..2 contiguous.
5. Exercise ids are unique across the whole plan (40 ids, `new Set(...).size === 40`).
6. Field bounds hold: `sets` 1–20, `reps` 1–50, `rpe` 1–10 with 0.5 steps,
   `restSec` 15–600, all integers except `rpe`.
7. `SAMPLE_PLAN.disclaimer` equals the exact string in §6 (verbatim, D4).
8. `SAMPLE_PLAN.schemaVersion === '0.1'` and `SAMPLE_PLAN.level === 'intermediate'`.
9. **Negative cases** — each must yield ≥ 1 issue, and the issue `path` must point
   at the offending field:
   - unknown top-level key (e.g. `commentary`) → issue (R2, A4)
   - `schemaVersion: "0.2"` → issue (R3)
   - `level: "elite"` → issue (R5)
   - `sets: 0` → issue (R9)
   - `rpe: 7.3` → issue (R9)
   - `restSec: 900` → issue (R9)
   - duplicated exercise `id` → issue (R9)
   - non-contiguous `week` numbers → issue (R6)
   - `disclaimer: ""` → issue (R4)

Build the negative fixtures by spreading the sample (e.g.
`{ ...SAMPLE_PLAN, level: 'elite' }`, and for the nested cases a spread of
`SAMPLE_PLAN.weeks[0].days[0].exercises[0]`) — **never** re-declare the whole
plan per case.

### Step 4 — `docs/contracts/plan-schema.md` (new)

Normative contract doc, in this order:

1. **Purpose & scope** — who consumes it (SPA renderer / gym-gate backend /
   kimi-k3.1 composer), what v0.1 covers, and the explicit statement that this
   document is normative and `src/shared/config/plan.schema.ts` mirrors it.
2. **Versioning** — `schemaVersion` is the contract version. v0.1 is a closed
   key set; any new top-level field = minor version bump (0.2) and a
   corresponding change in `plan.schema.ts`. Field-level additive changes to
   `PlanExercise` are a major bump (breaking for consumers that validate
   strictly). Never reuse or renumber a version.
3. **Top-level shape** — the table from §4.1, with the "exactly these 7 keys"
   rule spelled out.
4. **Nested shapes** — the §4.2 tables (weeks / days / exercises).
5. **Units** — a dedicated subsection: `sets` = count of working sets;
   `reps` = target reps per set (integer, no ranges in v0.1);
   `rpe` = Rate of Perceived Exertion 1–10, 0.5 steps, unitless;
   `restSec` = **seconds** between sets (integer); `week`/`day` = 1-based
   contiguous ordinals, not durations.
6. **Validation rules** — the R1–R9 table from §4.3, verbatim, with each rule
   phrased so an implementer in any language can check it.
7. **Example payload** — one week (2 days, 5 exercises each) as a JSON code
   block, so backend/composer authors can eyeball the exact wire shape.
8. **The disclaimer (D4)** — fixed key `disclaimer`, string, rendered verbatim
   by the UI; no interpretation, no truncation.
9. **Out of scope for v0.1** — auth fields, analytics, AI-commentary object
   (arrives in a later card), rep ranges, exercise-level media, per-user state.
10. **Changelog** — one line: `v0.1 — initial contract.`

Keep the doc **prose + tables + one JSON block**. No second JSON Schema copy:
two copies drift.

---

## 6. Sample content (normative — implement verbatim)

4 weeks × 2 day-splits × 5 exercises = **40 exercises**. Day-splits: `"Upper"` (day 1) and `"Lower"` (day 2) in every week.

**Week focus:** W1 `"Base Volume"` · W2 `"Build"` · W3 `"Peak"` · W4 `"Deload"`

Each cell below is `sets × reps @ RPE, rest`. `rest` values are **seconds**.

| Day 1 — Upper | W1 | W2 | W3 | W4 |
|---|---|---|---|---|
| Barbell Bench Press | 4×8 @7, 120 | 4×8 @8, 120 | 5×6 @8, 150 | 3×8 @6, 90 |
| Weighted Pull-up | 4×6 @7, 120 | 4×6 @8, 120 | 5×5 @8, 150 | 3×6 @6, 90 |
| Incline Dumbbell Press | 3×10 @7, 90 | 3×10 @8, 90 | 4×8 @8, 90 | 2×10 @6, 60 |
| Seated Dumbbell Shoulder Press | 3×12 @7, 60 | 3×12 @8, 60 | 4×10 @8, 75 | 2×12 @6, 60 |
| Cable Triceps Pushdown | 3×15 @7, 45 | 3×15 @8, 45 | 4×12 @8, 60 | 2×15 @6, 45 |

| Day 2 — Lower | W1 | W2 | W3 | W4 |
|---|---|---|---|---|
| Back Squat | 5×5 @7, 180 | 5×5 @8, 180 | 6×4 @8, 210 | 4×5 @6, 120 |
| Romanian Deadlift | 3×8 @7, 120 | 3×8 @8, 120 | 4×8 @8, 120 | 2×8 @6, 90 |
| Bulgarian Split Squat | 3×10 @7, 90 | 3×10 @8, 90 | 4×8 @8, 90 | 2×10 @6, 60 |
| Leg Press | 3×12 @7, 90 | 3×12 @8, 90 | 4×12 @8, 90 | 2×12 @6, 60 |
| Standing Calf Raise | 4×15 @7, 45 | 4×15 @8, 45 | 5×12 @8, 60 | 3×15 @6, 45 |

**Exercise `id` scheme:** kebab-case, globally unique, deterministic:
`<split>-<exercise-slug>-w<week>` — e.g. `upper-barbell-bench-press-w1`,
`lower-back-squat-w3`. Day `day` is 1 (`Upper`) / 2 (`Lower`) within each week;
`week` is 1–4; `split` is `"Upper"` / `"Lower"`.

**Progression logic** (sanity-checkable by the Tester): W1 = RPE 7 base;
W2 = same volume at RPE 8; W3 = +1 set and lower reps at RPE 8;
W4 = deload, RPE 6 and −1 set (except Back Squat, which drops from 6 to 4 sets
at RPE 6). Rest never decreases as sets increase.

---

## 7. Acceptance checklist (testable)

Task acceptance criteria → checks:

| # | Criterion | Check |
|---|---|---|
| A1 | `docs/contracts/plan-schema.md` defines the plan JSON: object shape, field names, units, validation rules | File exists; contains a top-level shape table, an explicit **Units** section, the R1–R9 rule table, and a JSON example |
| A2 | `src/shared/config/plan.schema.ts` exports a TypeScript type matching the contract | `TrainingPlan` (+ `PlanWeek`/`PlanDay`/`PlanExercise`/`PlanLevel`) exported; every field in the doc's tables exists in the type with the documented type; `validatePlan` + `isPlan` exported |
| A3 | `src/shared/config/plan.sample.ts` exports a static sample: 4 weeks × 2 day-splits, 5 exercises per day, each with sets/reps/rpe/rest — matching §6 | `SAMPLE_PLAN` exported; `weeks.length === 4`; every week `days.length === 2`; every day `exercises.length === 5`; every exercise has `sets`/`reps`/`rpe`/`restSec`; content equals §6 |
| A4 | The sample type-checks (`pnpm typecheck` green) | `pnpm typecheck` exits 0 |

Repo gates (AGENTS.md / CI):

| # | Check | Command |
|---|---|---|
| G1 | Lint clean, zero errors | `pnpm lint` |
| G2 | Typecheck clean | `pnpm typecheck` |
| G3 | Tests pass (new test file included) | `pnpm test` |
| G4 | Build passes | `pnpm build` |
| G5 | Drift-check green | `node scripts/check-agents-md.mjs` |
| G6 | Tests live in the same commit, never empty | `src/shared/config/__tests__/plan.test.ts` present in the diff |

**Definition of done for the Developer:** the commit adds exactly the 4 files in
§2, `pnpm lint && pnpm typecheck && pnpm test` are green, and the new test file
exercises every case from §5, Step 3 (8 positive + 9 negative).

**Definition of done for the Tester:** G1–G6 pass, plus A1–A4 each get a
one-line evidence pointer (file + line, or command output).

---

## 8. Risks

**R1 — Stitch parity is unverifiable inside this repo (A1).** The acceptance
criterion says "matching Stitch screens' content exactly", but the Stitch
assets are not vendored — only the project id in `tokens.css`. *Mitigation:*
§6 fixes the content normatively so the criterion is checkable against the
plan itself; the human gate confirms the table matches the Stitch screens.
*If it does not match, the fix is a table edit in this plan, not an
implementation change.*

**R2 — Domain-shaped types live in `shared/`.** `src/shared/config/site.ts` is
commented "global, business-free starter configuration"; a training plan is
domain data, and AGENTS.md puts "cross-feature data models" in `src/entities/`.
*Mitigation:* the task pins `src/shared/config/plan.schema.ts`, and `shared` is
the only layer every consumer (entities, features, pages) can legally import
without an upward import. *Future:* when the live plan entity/API lands
(`src/entities/plan/`), it should **import and re-export** the shared contract
rather than re-declare it — do not duplicate the types.

**R3 — Backend drift.** The gym-gate backend and the kimi-k3.1 composer live
outside this repo. A prose contract + a TS type can still drift from their
implementations. *Mitigation:* the doc is normative and versioned
(`schemaVersion`); R2's closed key set makes an early `commentary` object a
loud failure rather than a silent gap. The backend's mirrored types are a
separate card.

**R4 — `AGENTS.md` must not be edited.** The drift-check is a two-way binding:
adding a `<!--check: plan-contract-->` marker to `AGENTS.md` without a matching
entry in `scripts/check-agents-md.mjs` fails CI
("rule … has a marker but no check is mapped"). *Mitigation:* this task touches
no AGENTS.md marker. If contract enforcement is wanted, it is a separate card
that adds the check to the script **and** the marker together.

**R5 — `satisfies` vs `as const` friction.** `as const` makes arrays `readonly`
and is not assignable to `TrainingPlan`'s mutable arrays; a Developer who
writes `as const satisfies TrainingPlan` gets a type error that looks like a
schema problem. *Mitigation:* §5, Step 2 pins `satisfies TrainingPlan` (no
`as const`) and gives the `const SAMPLE_PLAN: TrainingPlan = {...}` fallback.

**R6 — Scope creep into UI.** "so UI work can proceed" invites a plan-renderer
feature. *Mitigation:* §1 non-goals are explicit; no page, route or feature
changes in this task. The sample exists to be consumed by a later card.

**R7 — Validator strictness vs composer output.** A hand-rolled strict
validator will reject a composer that emits, say, `restSec: 10` or a rep range
string. That is the intended v0.1 behaviour (R2 closed set, A3 no ranges), but
it must be stated in the doc's **Out of scope** section so the composer author
is not surprised.

---

## 9. References

- **ADR-0001 D5** (design tokens — `src/shared/ui/tokens.css`): not triggered by
  this task; the deliverables carry no styling. The rule is cited here so the
  Developer does not introduce a color/hex literal in `plan.sample.ts` while
  formatting it.
- **ADR-0002**: not referenced by any file in this repo at the time of writing —
  the plan does not depend on it.
- **`docs/contracts/plan-schema.md`**: created by this task; normative for all
  three consumers. `src/shared/config/plan.schema.ts` mirrors it — if they ever
  disagree, the doc wins and the TS file is the bug.
- **D4 (disclaimer)**: fixed key `disclaimer` on the plan root, rendered
  verbatim by the UI.
- **AGENTS.md**: FSAA layers, no upward imports, tests in the same commit,
  pnpm-only, never commit to `main`.
