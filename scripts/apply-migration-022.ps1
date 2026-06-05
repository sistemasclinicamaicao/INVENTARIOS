# Migración integraciones Socrata (SODA / datos.gov.co)
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
$sql = Join-Path $Root "backend\migrations\022_external_integrations_socrata.sql"

Write-Host "Aplicando migracion 022 (integraciones Socrata)..." -ForegroundColor Cyan
Get-Content $sql -Raw | docker exec -i clinica_erp_postgres psql -U $user -d $db
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Migracion 022 aplicada" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Contenedor clinica_erp_postgres debe estar activo" -ForegroundColor Red
}
