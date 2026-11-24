# 0008 — Model resolution law (supersedes ADR-0002 decision #2)

- **Status:** accepted
- **Date:** 2026-11-24
- **Deciders:** Veaceslav (round-3 review N1: the recorded precedence contradicted the live code; filed the REALITY as the law instead of drifting)

## Context

ADR-0002 #2 recorded the precedence as "RUN_MODEL → yaml table → role
contract", but the shipped code on rail #1 resolves
`RUN_MODEL → role frontmatter → yaml table` — and the frontmatter models
(deepseek/glm ids) ARE the live rail-#1 facts, proven by every combat hop.
Three files disagreed; round-3 review named the exact three-way drift.

## Decision — one precedence, per rail

- **Rail #1 (claude + Ollama Cloud):** `RUN_MODEL` (one-shot) → role
  contract frontmatter `model:` → yaml `agents-pipeline.yaml` fallback.
  The frontmatter is a RAIL-#1 FACT (Ollama ids), not a portable hint.
- **Rail #2 (Copilot):** `RUN_MODEL` → copilot yaml table → (no
  contract-frontmatter: Ollama ids would die as unknown ids).
- The yaml table is the FALLBACK and the place to override; the frontmatter
  is the per-project-per-role default. Fallback law stays: deepseek dead →
  planner = kimi-k2.7-code, never k3.1-pro (ADR-0004 economics).

## Consequences

- ADR-0002 decision #2 is superseded by this ADR. Decisions #1 (rails) and
  #3 (smoke) stand.
- MODELS-AND-ENV.md is the single precedence reference; ST-6 asserts this
  order.

## References

- docs/design/2026-11-24-trust-core-round3.md N1; run-agent.mjs resolution block
