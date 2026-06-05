# RBAC: permisos por rol + usuario admin/bodeguero demo
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
$sql = Join-Path $Root "backend\migrations\005_rbac_permissions.sql"

Write-Host "Aplicando migracion 005 (RBAC)..." -ForegroundColor Cyan
Get-Content $sql -Raw | docker exec -i clinica_erp_postgres psql -U $user -d $db
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Migracion 005 aplicada" -ForegroundColor Green
    Write-Host "  Admin: 1234567890 / Admin123! | Bodeguero: 9876543210 (misma clave si existe en seed)" -ForegroundColor Gray
} else {
    Write-Host "[ERROR] Contenedor clinica_erp_postgres debe estar activo" -ForegroundColor Red
}
