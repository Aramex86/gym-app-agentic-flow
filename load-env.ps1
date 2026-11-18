# load-env.ps1 - loads repo .env into this shell (Process scope) the way
# run-agent does, incl. the ANTHROPIC_* mapping for a manual `claude -p` probe.
# Usage (repo root, once per shell): . .\load-env.ps1
Get-Content .env | ForEach-Object {
  $kv = $_ -split '=', 2
  if ($kv.Count -eq 2 -and $kv[0].Trim() -ne '' -and $kv[0].Trim() -notmatch '^#') {
    [Environment]::SetEnvironmentVariable($kv[0].Trim(), $kv[1].Trim(), 'Process')
  }
}
if ($env:OLLAMA_BASE_URL -and !$env:ANTHROPIC_BASE_URL) {
  [Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', $env:OLLAMA_BASE_URL, 'Process')
}
if ($env:OLLAMA_API_KEY -and !$env:ANTHROPIC_AUTH_TOKEN) {
  [Environment]::SetEnvironmentVariable('ANTHROPIC_AUTH_TOKEN', $env:OLLAMA_API_KEY, 'Process')
}
if ($env:ANTHROPIC_API_KEY) { [Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', $null, 'Process') }
$loaded = (Get-ChildItem env: | Where-Object { $_.Name -match 'ANTHROPIC|OLLAMA|STITCH' } | Measure-Object).Count
Write-Host ("env loaded: $loaded vars (OLLAMA/ANTHROPIC/STITCH)")
