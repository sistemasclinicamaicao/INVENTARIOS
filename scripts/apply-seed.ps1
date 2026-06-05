# Aplica datos operativos (002) a PostgreSQL
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (Test-Path (Join-Path $Root ".env")) {
    Get-Content (Join-Path $Root ".env") | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

$port = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5434" }
$user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "clinica" }
$db = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "clinica_erp" }
$sql = Join-Path $Root "backend\migrations\002_seed_operational_data.sql"

Write-Host "Aplicando seed en localhost:$port ..." -ForegroundColor Cyan
Get-Content $sql -Raw | docker exec -i clinica_erp_postgres psql -U $user -d $db
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Datos operativos cargados" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Revise que el contenedor clinica_erp_postgres este activo" -ForegroundColor Red
}
