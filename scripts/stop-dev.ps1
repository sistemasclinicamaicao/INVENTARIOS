# Clínica ERP — Detener servicios de desarrollo
# Uso: .\scripts\stop-dev.ps1
#      .\scripts\stop-dev.ps1 -Quiet   # sin mensajes (llamado desde start-dev)

param([switch]$Quiet)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$apiPort = 3050
$frontPort = 3010

$envFile = Join-Path $Root ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*API_PORT=(\d+)') { $apiPort = [int]$matches[1] }
        if ($_ -match '^\s*FRONTEND_PORT=(\d+)') { $frontPort = [int]$matches[1] }
    }
}

if (-not $Quiet) {
    Write-Host ""
    Write-Host "  Deteniendo Clínica ERP..." -ForegroundColor Cyan
    Write-Host ""
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker compose stop postgres redis 2>$null
    if (-not $Quiet) { Write-Host "  [OK] Docker postgres/redis detenidos" -ForegroundColor Green }
}

foreach ($port in @($apiPort, $frontPort)) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        $procId = $conn.OwningProcess
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -match 'node') {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            if (-not $Quiet) {
                Write-Host "  [OK] Proceso en puerto $port detenido (PID $procId)" -ForegroundColor Green
            }
        }
    }
}

if (-not $Quiet) {
    Write-Host ""
    Write-Host "  Cierre manualmente las ventanas PowerShell de backend/frontend si siguen abiertas." -ForegroundColor DarkGray
    Write-Host ""
}
