# Elimina datos de demostración de la BD
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
$sql = Join-Path $Root "backend\migrations\003_clear_demo_operational.sql"

Write-Host "Eliminando datos de demostracion..." -ForegroundColor Yellow
Get-Content $sql -Raw -Encoding UTF8 | docker exec -i clinica_erp_postgres psql -U $user -d $db
Write-Host "[OK] Base lista para cargar informacion real." -ForegroundColor Green
Write-Host "Siguiente: importe CSV desde data\plantillas\ o use Maestros en la app." -ForegroundColor Cyan
