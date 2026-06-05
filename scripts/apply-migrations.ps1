# Aplica migraciones 002-004 (idempotentes donde aplica)
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

foreach ($file in @("002_seed_operational_data.sql", "004_suppliers.sql", "005_rbac_permissions.sql", "006_invima_reference.sql", "007_po_lines_extended.sql", "009_external_integrations.sql", "011_deactivate_uci_quirofano.sql", "012_warehouse_erp_bodega_codes.sql", "013_supplier_products.sql", "014_po_cxc_fulfillment_status.sql", "015_cxc_warehouse_catalog.sql", "016_cxc_warehouse_codes_fix.sql", "017_utf8_warehouse_names.sql", "018_products_code_per_catalog.sql")) {
    $sql = Join-Path $Root "backend\migrations\$file"
    if (-not (Test-Path $sql)) { continue }
    Write-Host "Aplicando $file ..." -ForegroundColor Cyan
    Invoke-PsqlFile -SqlPath $sql -User $user -Database $db
}
Write-Host "[OK] Migraciones aplicadas (revise salida si hubo conflictos ON CONFLICT)" -ForegroundColor Green
