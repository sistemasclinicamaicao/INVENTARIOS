# Detecta puertos libres y genera/actualiza .env para Clínica ERP
# Uso: .\scripts\detect-ports.ps1
#      .\scripts\detect-ports.ps1 -Mostrar   # solo muestra estado, no escribe .env

param([switch]$Mostrar)

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Test-PortInUse([int]$Port) {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $conn
}

function Get-PortOwner([int]$Port) {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $conn) { return $null }
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc) {
        return "$($proc.ProcessName) (PID $($conn.OwningProcess))"
    }
    return "PID $($conn.OwningProcess)"
}

# Orden: preferidos para este proyecto (evitan 3000 genérico, 5432 WAMP, 6379 Docker ajeno, 3030 node)
$candidates = @{
    API_PORT         = @(3050, 3052, 3060, 3000, 3070)
    FRONTEND_PORT    = @(3010, 3051, 3020, 3040, 3011)   # 3030 suele estar ocupado
    POSTGRES_PORT    = @(5434, 5435, 5440, 5436, 5437)
    REDIS_PORT       = @(6380, 6381, 6390, 6379)
}

function Find-FreePort([int[]]$List) {
    foreach ($p in $List) {
        if (-not (Test-PortInUse $p)) { return $p }
    }
    return $null
}

Write-Host ""
Write-Host "  Escaneo de puertos - Clínica ERP" -ForegroundColor Cyan
Write-Host ""

$assigned = @{}
$conflicts = @()

foreach ($key in $candidates.Keys) {
    $list = $candidates[$key]
    Write-Host "  $key" -ForegroundColor White
    foreach ($p in $list) {
        $used = Test-PortInUse $p
        $owner = if ($used) { Get-PortOwner $p } else { $null }
        $mark = if ($used) { "OCUPADO" } else { "libre" }
        $color = if ($used) { "Yellow" } else { "DarkGray" }
        $extra = if ($owner) { " -> $owner" } else { "" }
        Write-Host "    $p : $mark$extra" -ForegroundColor $color
    }
    $free = Find-FreePort $list
    if ($free) {
        $assigned[$key] = $free
        Write-Host "    => elegido: $free" -ForegroundColor Green
    } else {
        $conflicts += $key
        Write-Host "    => SIN PUERTO LIBRE" -ForegroundColor Red
    }
    Write-Host ""
}

if ($conflicts.Count -gt 0) {
    Write-Host "  No hay puertos libres para: $($conflicts -join ', ')" -ForegroundColor Red
    exit 1
}

$apiPort = $assigned.API_PORT
$frontPort = $assigned.FRONTEND_PORT
$pgPort = $assigned.POSTGRES_PORT
$redisPort = $assigned.REDIS_PORT

$envContent = @"
# Generado por scripts/detect-ports.ps1 - $(Get-Date -Format 'yyyy-MM-dd HH:mm')
# Puertos asignados tras escanear conflictos en este equipo

POSTGRES_USER=clinica
POSTGRES_PASSWORD=clinica_secret
POSTGRES_DB=clinica_erp
POSTGRES_PORT=$pgPort

REDIS_PORT=$redisPort

API_PORT=$apiPort
JWT_SECRET=dev_secret_change_me
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
OTP_TTL_SECONDS=300
CORS_ORIGIN=http://localhost:$frontPort

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@clinica.local

HR_API_URL=http://localhost:3999/mock/hr
HR_API_KEY=dev-key
HIS_WEBHOOK_SECRET=dev-his-secret

FRONTEND_PORT=$frontPort
NUXT_PUBLIC_API_BASE=/api/v1
NUXT_API_PROXY=http://127.0.0.1:${apiPort}

AUTH_DISABLED=true

DATABASE_URL=postgresql://clinica:clinica_secret@localhost:${pgPort}/clinica_erp
REDIS_URL=redis://localhost:${redisPort}
"@

if ($Mostrar) {
    Write-Host "  Puertos que se asignarían:" -ForegroundColor Cyan
    $assigned.GetEnumerator() | ForEach-Object { Write-Host "    $($_.Key) = $($_.Value)" }
    exit 0
}

$outPath = Join-Path $Root ".env"
$envContent | Set-Content -Path $outPath -Encoding UTF8
Write-Host "  [OK] Archivo .env actualizado: $outPath" -ForegroundColor Green
Write-Host ""
Write-Host "  Resumen:" -ForegroundColor Cyan
Write-Host "    API (NestJS)     -> http://localhost:$apiPort" -ForegroundColor White
Write-Host "    Frontend (Nuxt)  -> http://localhost:$frontPort" -ForegroundColor White
Write-Host "    PostgreSQL       -> localhost:$pgPort" -ForegroundColor White
Write-Host "    Redis            -> localhost:$redisPort" -ForegroundColor White
Write-Host ""
