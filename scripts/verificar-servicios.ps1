# Verifica que API y Frontend estén activos
$Root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $Root ".env"
$apiPort = 3050
$frontPort = 3051
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*API_PORT=(\d+)') { $apiPort = [int]$matches[1] }
        if ($_ -match '^\s*FRONTEND_PORT=(\d+)') { $frontPort = [int]$matches[1] }
    }
}

function Test-Listen([int]$Port) {
    return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -EA SilentlyContinue)
}

Write-Host ""
Write-Host "  Clinica ERP - Estado de servicios" -ForegroundColor Cyan
Write-Host ""

$apiOk = Test-Listen $apiPort
$frontOk = Test-Listen $frontPort

Write-Host "  API (NestJS)  puerto $apiPort : $(if($apiOk){'ACTIVO'}else{'NO ACTIVO - ejecute backend'})" -ForegroundColor $(if($apiOk){'Green'}else{'Red'})
Write-Host "  Frontend Nuxt puerto $frontPort : $(if($frontOk){'ACTIVO'}else{'NO ACTIVO - ejecute frontend o iniciar.bat'})" -ForegroundColor $(if($frontOk){'Green'}else{'Red'})

if ($frontOk) {
    Write-Host ""
    Write-Host "  Abra en el navegador (Chrome/Edge):" -ForegroundColor White
    Write-Host "    http://127.0.0.1:$frontPort" -ForegroundColor Cyan
    Write-Host "    http://localhost:$frontPort" -ForegroundColor Cyan
}
if (-not $frontOk) {
    Write-Host ""
    Write-Host "  El error 'Unsafe attempt to load URL... chrome-error' significa" -ForegroundColor Yellow
    Write-Host "  que el frontend NO estaba corriendo. Use iniciar.bat" -ForegroundColor Yellow
}
Write-Host ""
