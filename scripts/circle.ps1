# scripts/circle.ps1 - full pipeline circle (+ auto-fix loop) for one task.
#
# Run circle:   .\scripts\circle.ps1 tasks\<date>-<name>.md
# Fix loop:     .\scripts\circle.ps1 -Fix
#     (finds the newest *-report.md, sends the bug-log to the developer,
#      re-runs the tester, up to 3 rounds; stops on PASS)
#
# Machine gates live in run-agent; human gates are console pauses.

param(
  [string]$Task,
  [string]$DevContext = "implement the plan from the input file",
  [switch]$Fix,
  [int]$MaxFixRounds = 3
)

$ErrorActionPreference = "Stop"

function Run-Hop {
  param([string[]]$HopArgs)
  node scripts/run-agent.mjs @HopArgs
  return $LASTEXITCODE
}

function Get-NewestReport {
  $r = Get-ChildItem "docs/plans" -Filter "*-report.md" -ErrorAction SilentlyContinue |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1
  return $r.FullName
}

# ---------- FIX LOOP ----------
if ($Fix) {
  for ($round = 1; $round -le $MaxFixRounds; $round++) {
    $report = Get-NewestReport
    if (-not $report) { Write-Host "no *-report.md found in docs/plans" -ForegroundColor Red; exit 1 }

    $firstLine = (Get-Content $report -TotalCount 1).Trim()
    if ($firstLine -match "^PASS") {
      Write-Host "PASS already. Nothing to fix." -ForegroundColor Green; exit 0
    }

    Write-Host "`n===> FIX round $round (report: $report)" -ForegroundColor Cyan
    $code = Run-Hop @("developer", "-i", $report,
      "fix ONLY the items in the bug-log of the input report (it starts with FAIL). Touch no files beyond what the bug-log names. Tests in same commit.")
    if ($code -ne 0) { Write-Host "developer fix hop failed" -ForegroundColor Red; exit 1 }

    # re-run the tester against the same plan
    $base = ([IO.Path]::GetFileNameWithoutExtension($report)) -replace '-report$', ''
    Write-Host "`n===> RE-TEST (round $round)" -ForegroundColor Cyan
    $code = Run-Hop @("tester", "-i", "docs/plans/$base-plan.md")
    if ($code -ne 0) { Write-Host "tester hop failed" -ForegroundColor Red; exit 1 }

    $v = (Get-Content (Get-NewestReport) -TotalCount 1).Trim()
    if ($v -match "^PASS") {
      Write-Host "`nPASS after $round fix round(s)." -ForegroundColor Green
      Get-Content (Get-NewestReport) -TotalCount 3
      Write-Host "Your move: add/commit/push/PR (human only)."; exit 0
    }
    Write-Host "still FAIL after round $round - looping" -ForegroundColor Yellow
  }
  Write-Host "FAIL persists after $MaxFixRounds rounds - escalate to planner (re-plan) manually." -ForegroundColor Red
  exit 1
}

# ---------- NORMAL CIRCLE ----------
if (-not $Task) { Write-Host "usage: .\scripts\circle.ps1 tasks\<task>.md   |   .\scripts\circle.ps1 -Fix" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $Task)) { Write-Host "task file not found: $Task" -ForegroundColor Red; exit 1 }

$name   = ([IO.Path]::GetFileNameWithoutExtension($Task)) -replace '-plan$', ''
$plan   = "docs/plans/$name-plan.md"
$report = "docs/plans/$name-report.md"

Write-Host "`n===> PLANNER" -ForegroundColor Cyan
$code = Run-Hop @("planner", "-i", $Task)
if ($code -ne 0) { Write-Host "planner hop failed" -ForegroundColor Red; exit 1 }

Write-Host "`n>> plan written to $plan" -ForegroundColor Yellow
$yn = Read-Host "Read the plan. Continue to developer? (Y/N)"
if ($yn -ne "Y") { Write-Host "circle stopped at plan gate"; exit 0 }

Write-Host "`n===> DEVELOPER" -ForegroundColor Cyan
$code = Run-Hop @("developer", "-i", $plan, $DevContext)
if ($code -ne 0) { Write-Host "developer hop failed" -ForegroundColor Red; exit 1 }

Write-Host "`n>> working tree after developer:" -ForegroundColor Yellow
git status --short
git diff --stat
$yn = Read-Host "Continue to tester? (Y/N)"
if ($yn -ne "Y") { Write-Host "circle stopped before tester"; exit 0 }

Write-Host "`n===> TESTER" -ForegroundColor Cyan
$code = Run-Hop @("tester", "-i", $plan)
if ($code -ne 0) { Write-Host "tester hop failed" -ForegroundColor Red; exit 1 }

Write-Host "`n===> VERDICT" -ForegroundColor Green
Get-Content $report -TotalCount 3
$v = (Get-Content $report -TotalCount 1).Trim()
if ($v -match "^FAIL") {
  Write-Host "FAIL detected - auto fix loop available:" -ForegroundColor Yellow
  Write-Host "  .\scripts\circle.ps1 -Fix" -ForegroundColor Yellow
  exit 1
}
Write-Host "PASS -> your move: add/commit/push/PR (human only). Artifacts stay local (gitignored)."
