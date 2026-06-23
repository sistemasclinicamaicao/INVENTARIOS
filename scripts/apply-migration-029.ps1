# Tablas invima_pmv_import_batches e invima_pmv_registros (precios PMV INVIMA)
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (Test-Path (Join-Path $Root ".env")) {
    Get-Content (Join-Path $Root ".env") | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

$sql = Join-Path $Root "backend\migrations\029_invima_pmv_registros.sql"
$dbUrl = $env:DATABASE_URL

Write-Host "Aplicando migracion 029 (precios PMV INVIMA)..." -ForegroundColor Cyan

if ($dbUrl -and $dbUrl -match '^postgres') {
    $dbUrl = $dbUrl -replace '^postgres://', 'postgresql://'
    $env:PGPASSWORD = ($dbUrl -replace '^.*://[^:]+:([^@]+)@.*$', '$1')
    psql $dbUrl -f $sql
} else {
    $user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "clinica" }
    $db = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "clinica_erp" }
    Get-Content $sql -Raw | docker exec -i clinica_erp_postgres psql -U $user -d $db
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Migracion 029 aplicada" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Revise DATABASE_URL en .env o contenedor postgres local" -ForegroundColor Red
    exit 1
}
