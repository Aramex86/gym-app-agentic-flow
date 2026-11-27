// scripts/test-gate.mjs — TARGETED TESTER HOP (master 27.11).
// The tester must verify ONLY the tests mapped from the developer's changed
// files; the full suite is the nightly/statistics run. Pure functions,
// zero deps — exercised by ST-34 (and ST-25 for the mapper).
//
// `buildTestGate(profile, changedFiles)` returns:
//   { cmd, tests, structural, targeted, note }
// cmd = null means "full gate" (honest fallback), never a fake command.

import { parseDiff, mapToTests, targetedGate } from "./changed-tests.mjs";

export function buildTestGate(profile, changedFiles) {
  const files = Array.isArray(changedFiles)
    ? changedFiles
    : parseDiff(String(changedFiles || ""));
  const { tests, structural } = mapToTests(files);
  const cmd = targetedGate(profile || {}, tests, structural);
  let note;
  if (cmd) note = `targeted: ${tests.length} mapped test file(s)`;
  else if (structural) note = "targeted skipped: structural changes — full gate is the honest check";
  else if (!tests.length) note = "targeted skipped: no code files changed";
  else note = "targeted skipped: no test-targeted template in the passport — full gate runs";
  return { cmd, tests, structural, targeted: !!cmd, note };
}
