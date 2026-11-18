# EVAL READING GUIDE - how to read a failed run yourself
(5 layers: every fail belongs to exactly one)

## 1. The four places to read (in order)

| # | Place | What it answers |
|---|-------|-----------------|
| 1 | Console lines (deps / EVAL / hop runs) | did the run even get built correctly? |
| 2 | `docs/plans/<name>-report.md` (in sandbox `work\<name>\`) | what did the tester SEE? |
| 3 | `evals\results\scoreboard.jsonl` (last line) | mechanical verdict per check |
| 4 | `.pipeline/runs/<ts>__<slug>/trace.jsonl` | timeline: who ran when, exit codes |

## 2. Console - key markers

```
EVAL <name> - expect verdict=PASS, files=2, budget=900s   <- answer key read OK?
                                                              files=0/budget=0 -> answer key not parsed
removed stale sandbox dir                                  <- clean sheet worked
Preparing worktree (new branch ...)                        <- sandbox created, branch fresh
deps: pnpm install ...                                     <- env provisioning started
   (Done/lines of pnpm  -> OK)
   (EVAL STOP: ...     -> env broken, run stops HONESTLY - never debug code first)
hop_end tester ... "artifact":"docs/plans/...-report.md"   <- tester delivered its report
EVAL: FAIL -> developer fix round 1/2 (bug-log driven)     <- self-fix engaged
machine gate: expected artifact missing: ...-report.md     <- role died BEFORE writing artifact
EVAL RESULT / verdict files scope fixes time               <- final grade
```

## 3. The EVAL block - each line is WHY

```
Verdict : PASS/FAIL/MISSING      -> the REPORT's first word, parsed by runner
Files   : ok / missing: [paths]  -> answer key wanted files that did not appear
Scope   : clean / touched forbidden: [paths]
                                 -> COMMIT diff (from develop) vs forbidden_paths
Fix rounds: N / budget           -> self-fix attempts used
Time    : vs budget              -> cost signal (compare models/configs here)
```

## 4. Decision tree for a FAIL

```
1. Report first word FAIL vs grade FAIL?
   - grade FAIL, report PASS -> runner-side check (scope/time/files) - read line 2-4
   - report FAIL             -> tester found something -> go to bug-log
2. If tester FAIL: read "Cause" paragraph at top of report:
   - "environment blocker" / "permission denied" / "not recognized"
     -> LAYER: environment (deps, permissions) - NOT code
   - concrete file/line/test names
     -> LAYER: code - the bug-log names it, hand to developer
   - "could not be evidenced" / drift-check
     -> LAYER: instrumentation - the gate can't run headless, fix TOOLS/config
3. If machine gate "artifact missing": role crashed early
   -> read that role's tail of `.pipeline-last-run.log` (in sandbox) + trace exit code
```

## 5. Bug-log voice (what the tester owes you)

```
Bug N - <title>
What happened : <observed fact, command, output>
Why it matters: <which acceptance criterion it blocks>
How to fix    : <WHO: AGENT action | HUMAN gate | CONFIG, not vague advice>
```
If "How to fix: HUMAN" - decide if that gate belongs in the answer key as
a precondition (e.g. deps) instead of the report.

## 6. Worked examples - tonight's 5 fails, as signatures

```
F1. tester: "eslint/tsc/vitest not recognized"          -> env: sandbox has no deps
F2. same after junction                                  -> env: junction lacks .bin (use install)
F3. tester: fails on OLD dirty commit from previous run  -> sandbox not clean (reuse)
F4. tester: gates blocked, dev created fake .cmd stubs   -> env AND discipline (stubs = scope violation)
F5. grade: Scope touched forbidden: agents-pipeline.yaml
    BUT report PASS, commit diff clean, only dirty file  -> runner semantics bug (fixed: read commits, not worktree)
```
Rule: same symptom twice in a row = fix the LAYER, not the run.
