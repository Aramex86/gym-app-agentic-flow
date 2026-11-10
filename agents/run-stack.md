# Procedure: run-stack — boot the project from a clean clone

0. Node 20+. pnpm is pinned in packageManager — activate with corepack:
   `corepack enable` → `pnpm -v` prints the pinned version.
1. `pnpm install` — exit 0 expected
2. `pnpm lint` — zero errors expected
3. `pnpm typecheck` — zero errors expected
4. `pnpm build` — exit 0 expected
5. `pnpm dev` — server starts, note the port it prints. Agent-check (works
   headless): `curl -s -o /dev/null -w '%{http_code}' http://localhost:<port><path>`
   for `/`, `/orders`, `/projects` — each must print 200
6. Stop the server

Verify: steps 0–5 green, drift-check still green:

```bash
node scripts/check-agents-md.mjs
```

Human check (one time, in a browser): Home (/), Orders (/orders), Projects
(/projects) render and the console is clean — console errors are visible only
to a human, an agent cannot check them.

No fix-ups needed after a clean clone. If any step fails — report the exit code
and do not patch the code: the contract says report; fix only with an explicit task.