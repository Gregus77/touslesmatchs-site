$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$checks = @{
  (Join-Path $root 'public\index.html') = @('beta-cycle01-launcher', 'beta-cycle01-modal', '/beta-plus05/status', '/beta-plus05/apply', 'sessionStorage');
  (Join-Path $root 'scripts\api_server.js') = @('beta_plus05_applications', 'app.get("/beta-plus05/status"', 'app.post("/beta-plus05/apply"', 'BETA_PLUS05_CAPACITY');
  (Join-Path $root 'Dockerfile.api') = @('COPY scripts/beta_waitlist.js ./beta_waitlist.js');
}

foreach ($file in $checks.Keys) {
  $content = Get-Content -Raw $file
  foreach ($needle in $checks[$file]) {
    if (-not $content.Contains($needle)) { throw "Element absent dans $file : $needle" }
  }
}

Write-Output 'beta-cycle01-integration: OK'
