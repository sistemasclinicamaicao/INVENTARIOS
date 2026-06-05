# Vacía invima_registros y recarga desde integraciones Socrata INVIMA (datos.gov.co)
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (Test-Path (Join-Path $Root ".env")) {
    Get-Content (Join-Path $Root ".env") | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

Write-Host "Recarga INVIMA desde integraciones Socrata (vaciar + sync)..." -ForegroundColor Cyan
Push-Location (Join-Path $Root "backend")
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Fallo build backend" -ForegroundColor Red
    Pop-Location
    exit 1
}
npm run reload:invima-socrata
$code = $LASTEXITCODE
Pop-Location
if ($code -eq 0) {
    Write-Host "[OK] Referencia INVIMA recargada desde datos.gov.co" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Revise integraciones activas con token en Configuracion -> Integraciones" -ForegroundColor Red
}
exit $code
