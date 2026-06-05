# Migración integraciones salientes (reemplaza 008 inbound)
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
$sql = Join-Path $Root "backend\migrations\009_external_integrations.sql"

Write-Host "Aplicando migracion 009 (integraciones salientes)..." -ForegroundColor Cyan
Get-Content $sql -Raw | docker exec -i clinica_erp_postgres psql -U $user -d $db
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Migracion 009 aplicada" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Contenedor clinica_erp_postgres debe estar activo" -ForegroundColor Red
}
