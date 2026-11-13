# Plan JSON contract — v0.1

**Status:** Normative. `src/shared/config/plan.schema.ts` mirrors this document — if they ever disagree, **this document wins** and the TS file is the bug.

## 1. Purpose & scope

One data contract that three consumers agree on:

| Consumer | Role |
|---|---|
| SPA renderer (this repo) | Validates and renders a plan object |
| gym-gate backend | Stores and serves plan objects |
| kimi-k3.1 composer | Produces plan objects |

v0.1 covers the training-plan payload only: top-level metadata, weeks, day-splits and exercises. The AI-commentary object arrives in a later card and is **out of scope** here. There is no JSON Schema file — this document plus the TS type are the two (synchronised) artifacts.

## 2. Versioning

`schemaVersion` is the **contract** version (currently `"0.1"`), not the app version.

- v0.1 is a **closed** top-level key set. Any new top-level field = minor version bump (0.2) plus a matching change in `plan.schema.ts`.
- Field-level additive changes to `PlanExercise` are a **major** bump (breaking for consumers that validate strictly).
- Never reuse or renumber a version.

## 3. Top-level shape (`TrainingPlan`)

Exactly these 7 keys — no more, no less. Unknown top-level keys are a validation error.

| Field | Type | Unit / domain | Required | Notes |
|---|---|---|---|---|
| `schemaVersion` | literal string `"0.1"` | — | yes | Contract version |
| `planId` | string | non-empty, `[a-z0-9-]+` | yes | Stable id, kebab-case |
| `title` | string | non-empty | yes | Human-facing title |
| `goal` | string | non-empty | yes | Free text, composer-owned |
| `level` | union | `"beginner" \| "intermediate" \| "advanced"` | yes | Closed enum |
| `weeks` | `PlanWeek[]` | length ≥ 1 | yes | |
| `disclaimer` | string | non-empty | yes | Fixed key — see §8 |

## 4. Nested shapes

`PlanWeek`:

| Field | Type | Notes |
|---|---|---|
| `week` | number | 1-based contiguous ordinal (1, 2, 3, …) — not a duration |
| `focus` | string | non-empty, e.g. `"Base Volume"` |
| `days` | `PlanDay[]` | length ≥ 1 |

`PlanDay`:

| Field | Type | Notes |
|---|---|---|
| `day` | number | 1-based **within the week**, contiguous — not a duration |
| `split` | string | non-empty, day-split label, e.g. `"Upper"` |
| `exercises` | `PlanExercise[]` | length ≥ 1 |

`PlanExercise`:

| Field | Type | Unit / range | Notes |
|---|---|---|---|
| `id` | string | non-empty, **globally unique in the plan** | React key + backend reference |
| `name` | string | non-empty | Display name |
| `sets` | number | integer, 1–20 | Count of working sets |
| `reps` | number | integer, 1–50 | Target reps **per set** |
| `rpe` | number | 1–10, 0.5 steps | Rate of Perceived Exertion, unitless |
| `restSec` | number | integer, 15–600 | Seconds of rest between sets |

## 5. Units

- `sets` — count of working sets (integer).
- `reps` — target reps **per set** (integer). No ranges in v0.1: a composer emitting `"8-12"` is invalid by design.
- `rpe` — Rate of Perceived Exertion, unitless, 1–10 with **0.5 steps** (`rpe × 2` must be an integer).
- `restSec` — **seconds** of rest between sets (integer). The unit is in the field name; there is no `rest` field.
- `week` / `day` — 1-based contiguous ordinals, **not** durations or dates.

## 6. Validation rules (R1–R9)

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

Validation **collects** violations rather than throwing one at a time: the FE reference implementation (`validatePlan`) returns an array of `{ path, message }`, where `path` is a JSON-path-like string such as `weeks[0].days[1].exercises[2].sets`. An implementation in any language must satisfy the same rules; issue granularity and `path` format are recommended, not normative, outside the FE.

## 7. Example payload

One week (2 days, 5 exercises each):

```json
{
  "schemaVersion": "0.1",
  "planId": "sample-4w-upper-lower",
  "title": "Sample Hypertrophy Block — 4 Weeks",
  "goal": "Strength & hypertrophy",
  "level": "intermediate",
  "disclaimer": "This plan is for informational purposes only and is not medical advice. Consult a qualified professional before starting any training program.",
  "weeks": [
    {
      "week": 1,
      "focus": "Base Volume",
      "days": [
        {
          "day": 1,
          "split": "Upper",
          "exercises": [
            { "id": "upper-barbell-bench-press-w1", "name": "Barbell Bench Press", "sets": 4, "reps": 8, "rpe": 7, "restSec": 120 },
            { "id": "upper-weighted-pull-up-w1", "name": "Weighted Pull-up", "sets": 4, "reps": 6, "rpe": 7, "restSec": 120 },
            { "id": "upper-incline-dumbbell-press-w1", "name": "Incline Dumbbell Press", "sets": 3, "reps": 10, "rpe": 7, "restSec": 90 },
            { "id": "upper-seated-dumbbell-shoulder-press-w1", "name": "Seated Dumbbell Shoulder Press", "sets": 3, "reps": 12, "rpe": 7, "restSec": 60 },
            { "id": "upper-cable-triceps-pushdown-w1", "name": "Cable Triceps Pushdown", "sets": 3, "reps": 15, "rpe": 7, "restSec": 45 }
          ]
        },
        {
          "day": 2,
          "split": "Lower",
          "exercises": [
            { "id": "lower-back-squat-w1", "name": "Back Squat", "sets": 5, "reps": 5, "rpe": 7, "restSec": 180 },
            { "id": "lower-romanian-deadlift-w1", "name": "Romanian Deadlift", "sets": 3, "reps": 8, "rpe": 7, "restSec": 120 },
            { "id": "lower-bulgarian-split-squat-w1", "name": "Bulgarian Split Squat", "sets": 3, "reps": 10, "rpe": 7, "restSec": 90 },
            { "id": "lower-leg-press-w1", "name": "Leg Press", "sets": 3, "reps": 12, "rpe": 7, "restSec": 90 },
            { "id": "lower-standing-calf-raise-w1", "name": "Standing Calf Raise", "sets": 4, "reps": 15, "rpe": 7, "restSec": 45 }
          ]
        }
      ]
    }
  ]
}
```

## 8. The disclaimer (D4)

`disclaimer` is a **fixed key** on the plan root: a non-empty string the UI renders **verbatim** — no parsing, no markup, no truncation. Composers must not embed HTML/Markdown in it.

## 9. Out of scope for v0.1

- Auth fields, analytics.
- AI-commentary object — arrives in a later card; emitting it early is a **validation failure** (R2), by design.
- Rep ranges (single target integer only).
- Exercise-level media.
- Per-user state.
- Relaxed validation for composer convenience (e.g. `restSec < 15`, out-of-range values) — none; strictness is intentional, see §2.

## 10. Changelog

- v0.1 — initial contract.
