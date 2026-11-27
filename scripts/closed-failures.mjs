// scripts/closed-failures.mjs — CLOSED-CLASS HOP FAILURE (master 27.11).
// Pure classification at the agreed seam:
//   classifyHopFailure(failure, runs) -> { sev, note }
// A failed hop becomes INFO when a LATER run of the SAME circle (resume-
// prefix stripped) proves recovery: green hop_end of the same role or a
// PASS verdict. Otherwise it stays ERROR. No FS, no git — just data.

const normName = (n) => String(n || "").replace(/^resume-/, "").replace(/-+$/, "");

export function classifyHopFailure(failure, runs) {
  const list = Array.isArray(runs) ? runs : [];
  const name = normName(failure.name);
  const rid = String(failure.rid || "");
  for (const run of list) {
    if (String(run.rid || "") <= rid) continue;   // strictly later runs only
    if (normName(run.name) !== name) continue;
    for (const e of run.events || []) {
      if (e.event === "hop_end" && e.role === failure.role && e.exit === 0)
        return { sev: "info", note: `closed by ${run.rid}: ${failure.role} green` };
      if (e.event === "verdict" && e.result === "PASS")
        return { sev: "info", note: `closed by ${run.rid}: PASS verdict` };
    }
  }
  return { sev: "error", note: "open — no later green/PASS for this circle" };
}
