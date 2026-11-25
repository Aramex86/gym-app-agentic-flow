# Progress AI-review insight contract — v0.1

**Status:** Normative. `src/entities/session-log/api.ts` mirrors this document — if they ever disagree, **this document wins** and the TS file is the bug.

## 1. Purpose & scope

The wire contract for the Progress page's **AI review insight** card: the SPA asks the **gym-gate** for a prose review of one period of the session log. This is the "AI commentary" card that `docs/contracts/plan-schema.md` §1 explicitly reserved for a later card — that document is **not altered** by this file, and the insight payload stays out of the plan contract.

| Consumer | Role |
|---|---|
| SPA renderer (this repo) | Builds the request from the log, renders the insight |
| gym-gate backend | Receives the request, **performs the model call**, validates the response |
| kimi-k3.1 (via the gate) | Produces the prose — never called directly from the app |

## 2. Endpoint

| Field | Value |
|---|---|
| Method | `POST` |
| Path | `/api/progress/insight` (same origin) |
| Headers | `Content-Type: application/json` |
| Body encoding | UTF-8 JSON |

## 3. Request body (`ReviewInsightRequest`)

| Field | Type | Domain | Required | Notes |
|---|---|---|---|---|
| `model` | string | non-empty | yes | Model id the **gate** routes; the app sends `"kimi-k3.1"` (`INSIGHT_MODEL`). ADR-0008: routing is the gate's business. |
| `period` | object | `ReviewPeriod` | yes | `id`, `from`, `to`, `label`; window of the review, inclusive bounds. |
| `sessions` | array | `InsightSessionSummary[]` | yes | Compact per-session entries inside the period, ascending by date: `id`, `date`, `split`, `prCount`. |

## 4. Response body (2xx)

Exactly this envelope — no extra top-level keys:

| Field | Type | Validation |
|---|---|---|
| `periodId` | string | **Must equal** the requested `period.id` |
| `model` | string | non-empty |
| `insight` | string | non-empty prose |

## 5. Validation & error behavior

The client (`requestReviewInsight`) normalizes **every** failure into one app-level error (`InsightRequestError`, fixed non-leaky message); no response details leak to the UI:

| Failure | Client behavior |
|---|---|
| Network failure / unreachable gate | `InsightRequestError` |
| non-2xx status | `InsightRequestError` |
| invalid JSON body | `InsightRequestError` |
| payload failing §4 validation (mismatched `periodId`, missing/non-empty rule) | `InsightRequestError` |

The SPA degrades offline: the session history log and its PR badges render without any request (PRs are computed client-side), and the insight card shows a retry instead.

## 6. Example

Request (sample log; period ends at the newest session date, not `Date.now()`):

```json
{
  "model": "kimi-k3.1",
  "period": { "id": "last-4-weeks", "from": "2026-10-23", "to": "2026-11-19", "label": "Last 4 weeks" },
  "sessions": [
    { "id": "s-2026-11-02-upper", "date": "2026-11-02", "split": "Upper", "prCount": 0 },
    { "id": "s-2026-11-05-lower", "date": "2026-11-05", "split": "Lower", "prCount": 0 },
    { "id": "s-2026-11-09-upper", "date": "2026-11-09", "split": "Upper", "prCount": 1 },
    { "id": "s-2026-11-12-lower", "date": "2026-11-12", "split": "Lower", "prCount": 0 },
    { "id": "s-2026-11-16-upper", "date": "2026-11-16", "split": "Upper", "prCount": 1 },
    { "id": "s-2026-11-19-lower", "date": "2026-11-19", "split": "Lower", "prCount": 1 }
  ]
}
```

Response:

```json
{
  "periodId": "last-4-weeks",
  "model": "kimi-k3.1",
  "insight": "Bench progressed twice; squat PR at 122.5 kg e1RM."
}
```

## 7. Ownership note

The **gym-gate performs the model call**: the client never talks to a provider, never imports a model SDK, and never carries a provider URL. The model id in the request is data, not routing. Backend alignment happens here — changes to path, envelope or validation are made in this document first, then mirrored in `api.ts` (doc wins on disagreement).
