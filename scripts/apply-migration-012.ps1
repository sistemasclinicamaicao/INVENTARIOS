$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
if (Test-Path (Join-Path $Root ".env")) {
    Get-Content (Join-Path $Root ".env") | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}
$user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "clinica" }
$db = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "clinica_erp" }
$sql = Join-Path $Root "backend\migrations\012_warehouse_erp_bodega_codes.sql"
Write-Host "Aplicando 012_warehouse_erp_bodega_codes.sql ..." -ForegroundColor Cyan
Get-Content $sql -Raw | docker exec -i clinica_erp_postgres psql -U $user -d $db 2>&1
Write-Host "[OK] Migración 012" -ForegroundColor Green
