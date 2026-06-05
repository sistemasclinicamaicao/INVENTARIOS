# Comprueba que API (Nest) y Frontend (Nuxt) estén en puertos distintos
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

Write-Host ""
Write-Host "  Puertos Clinica ERP" -ForegroundColor Cyan
Write-Host "  API (NestJS)      -> $apiPort" -ForegroundColor White
Write-Host "  Frontend (Nuxt)   -> $frontPort" -ForegroundColor White
Write-Host ""

if ($apiPort -eq $frontPort) {
    Write-Host "  [ERROR] API_PORT y FRONTEND_PORT no pueden ser iguales." -ForegroundColor Red
    exit 1
}

foreach ($p in @($apiPort, $frontPort)) {
    $listeners = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $listeners) {
        $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        $name = if ($proc) { $proc.ProcessName } else { '?' }
        Write-Host "  Puerto $p : $name (PID $($c.OwningProcess))" -ForegroundColor $(if ($name -eq 'node') { 'Yellow' } else { 'Gray' })
    }
}

try {
    $h = Invoke-WebRequest -Uri "http://127.0.0.1:${apiPort}/api/v1/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "  [OK] API health -> $($h.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "  [AVISO] API no responde en $apiPort/api/v1/health" -ForegroundColor Yellow
}

try {
    $f = Invoke-WebRequest -Uri "http://127.0.0.1:${frontPort}/api/v1/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "  [OK] Proxy Nuxt /api/v1/health -> $($f.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "  [AVISO] Frontend/proxy no responde en $frontPort (¿Nuxt corriendo?)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Abra la app en: http://localhost:$frontPort" -ForegroundColor Cyan
Write-Host ""
