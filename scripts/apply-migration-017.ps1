$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
. "$PSScriptRoot\psql-utf8.ps1"
if (Test-Path (Join-Path $Root ".env")) {
    Get-Content (Join-Path $Root ".env") | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}
$user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "clinica" }
$db = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "clinica_erp" }
$sql = Join-Path $Root "backend\migrations\017_utf8_warehouse_names.sql"
Write-Host "Aplicando 017_utf8_warehouse_names.sql ..." -ForegroundColor Cyan
Invoke-PsqlFile -SqlPath $sql -User $user -Database $db
Write-Host "[OK] Migración 017" -ForegroundColor Green
