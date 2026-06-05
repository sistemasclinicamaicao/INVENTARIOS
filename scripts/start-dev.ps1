# Clínica ERP — Inicio automático de servicios (desarrollo)
# Uso: .\scripts\start-dev.ps1
#      .\scripts\start-dev.ps1 -SinDocker   # solo API + frontend (BD ya corriendo)

param(
    [switch]$SinDocker,
    [switch]$SinFrontend,
    [switch]$SinBackend,
    [switch]$DetectPorts,   # fuerza regenerar .env con puertos libres
    [switch]$SinDetectPorts # no escanear (usa .env tal cual)
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "docker-compose.yml"))) {
    Write-Host "  [ERROR] No se encontró docker-compose.yml en $Root" -ForegroundColor Red
    exit 1
}
Set-Location $Root

Write-Host ""
Write-Host "  Clínica ERP - Inicio de servicios" -ForegroundColor Cyan
Write-Host "  Raíz: $Root" -ForegroundColor DarkGray
Write-Host ""

$envFile = Join-Path $Root ".env"
$detectScript = Join-Path $PSScriptRoot "detect-ports.ps1"

# Generar .env con puertos libres si no existe o se solicita
if (-not $SinDetectPorts) {
    if ($DetectPorts -or -not (Test-Path $envFile)) {
        Write-Host "  Detectando puertos libres en este equipo..." -ForegroundColor Yellow
        & $detectScript
        if ($LASTEXITCODE -ne 0) { exit 1 }
    }
}

# Cargar .env
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim() -replace '^["'']|["'']$',''
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "  [OK] Variables cargadas desde .env" -ForegroundColor Green
}

# Valores por defecto (bloque 305x / 5434 / 6380 — evita conflictos habituales)
if (-not $env:POSTGRES_PORT) { $env:POSTGRES_PORT = "5434" }
if (-not $env:REDIS_PORT) { $env:REDIS_PORT = "6380" }
if (-not $env:API_PORT) { $env:API_PORT = "3050" }
if (-not $env:FRONTEND_PORT) { $env:FRONTEND_PORT = "3010" }
if (-not $env:POSTGRES_USER) { $env:POSTGRES_USER = "clinica" }
if (-not $env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD = "clinica_secret" }
if (-not $env:POSTGRES_DB) { $env:POSTGRES_DB = "clinica_erp" }
if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = "postgresql://${env:POSTGRES_USER}:${env:POSTGRES_PASSWORD}@localhost:${env:POSTGRES_PORT}/${env:POSTGRES_DB}"
}
if (-not $env:REDIS_URL) { $env:REDIS_URL = "redis://localhost:$($env:REDIS_PORT)" }
if (-not $env:JWT_SECRET) { $env:JWT_SECRET = "dev_secret_change_me" }
if (-not $env:NODE_ENV) { $env:NODE_ENV = "development" }
if (-not $env:CORS_ORIGIN) { $env:CORS_ORIGIN = "http://localhost:$($env:FRONTEND_PORT)" }
# Proxy Nuxt → API (mismo origen, sin CORS en el navegador)
# Siempre proxy Nuxt (mismo origen); no usar URL absoluta al API en el navegador
$env:NUXT_PUBLIC_API_BASE = "/api/v1"
if (-not $env:NUXT_API_PROXY) { $env:NUXT_API_PROXY = "http://127.0.0.1:$($env:API_PORT)" }
if (-not $env:AUTH_DISABLED) { $env:AUTH_DISABLED = "true" }
$env:PORT = $env:API_PORT

function Test-PortOpen([int]$Port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $Port)
        $tcp.Close()
        return $true
    } catch { return $false }
}

function Wait-Postgres {
    param([int]$MaxSeconds = 60)
    $port = [int]$env:POSTGRES_PORT
    Write-Host "  Esperando PostgreSQL en puerto $port..." -ForegroundColor Yellow
    $elapsed = 0
    while ($elapsed -lt $MaxSeconds) {
        if (Test-PortOpen $port) {
            Start-Sleep -Seconds 2
            Write-Host "  [OK] PostgreSQL listo" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
    Write-Host "  [AVISO] PostgreSQL no respondió en ${MaxSeconds}s. Revise: docker compose logs postgres" -ForegroundColor Yellow
    return $false
}

# Liberar solo procesos Node en puertos API/frontend (sin detener Docker)
foreach ($port in @([int]$env:API_PORT, [int]$env:FRONTEND_PORT)) {
    if (-not $port) { continue }
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        $procId = $_.OwningProcess
        $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($p -and $p.ProcessName -eq 'node') {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
}

# --- Docker: PostgreSQL + Redis ---
if (-not $SinDocker) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Host "  [ERROR] Docker no está instalado o no está en el PATH" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Iniciando Docker (postgres + redis)..." -ForegroundColor Yellow
    docker compose up postgres redis -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] docker compose falló. ¿Puerto ${env:POSTGRES_PORT} libre?" -ForegroundColor Red
        exit 1
    }
    Wait-Postgres | Out-Null
} else {
    Write-Host "  [-SinDocker] Omitiendo Docker" -ForegroundColor DarkGray
}

# --- Backend (nueva ventana) ---
if (-not $SinBackend) {
    $backendDir = Join-Path $Root "backend"
    if (-not (Test-Path "$backendDir\node_modules")) {
        Write-Host "  Instalando dependencias backend..." -ForegroundColor Yellow
        Push-Location $backendDir; npm install; Pop-Location
    }
    $backendCmd = @"
Set-Location '$backendDir'
`$env:DATABASE_URL='$($env:DATABASE_URL)'
`$env:REDIS_URL='$($env:REDIS_URL)'
`$env:JWT_SECRET='$($env:JWT_SECRET)'
`$env:NODE_ENV='$($env:NODE_ENV)'
`$env:PORT='$($env:API_PORT)'
`$env:CORS_ORIGIN='$($env:CORS_ORIGIN)'
`$env:AUTH_DISABLED='$($env:AUTH_DISABLED)'
Write-Host ' Compilando backend (dist)...' -ForegroundColor DarkGray
npm run build
if (`$LASTEXITCODE -ne 0) { Write-Host ' [ERROR] npm run build falló' -ForegroundColor Red; pause; exit 1 }
Write-Host ' API NestJS - http://localhost:$($env:API_PORT)/api/v1' -ForegroundColor Cyan
Write-Host ' Swagger    - http://localhost:$($env:API_PORT)/api/docs' -ForegroundColor Cyan
npm run start:dev
"@
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd -WindowStyle Normal
    Write-Host "  [OK] Backend iniciado (ventana nueva)" -ForegroundColor Green
}

# --- Frontend (nueva ventana) ---
if (-not $SinFrontend) {
    $frontendDir = Join-Path $Root "frontend"
    if (-not (Test-Path "$frontendDir\node_modules")) {
        Write-Host "  Instalando dependencias frontend..." -ForegroundColor Yellow
        Push-Location $frontendDir; npm install; Pop-Location
    }
    $frontendCmd = @"
Set-Location '$frontendDir'
`$env:NUXT_PUBLIC_API_BASE='/api/v1'
`$env:NUXT_API_PROXY='$($env:NUXT_API_PROXY)'
`$env:NUXT_PUBLIC_AUTH_DISABLED='$($env:AUTH_DISABLED)'
`$env:API_PORT='$($env:API_PORT)'
`$env:FRONTEND_PORT='$($env:FRONTEND_PORT)'
`$env:PORT='$($env:FRONTEND_PORT)'
Write-Host ' Frontend Nuxt - http://localhost:$($env:FRONTEND_PORT)' -ForegroundColor Cyan
Write-Host ' (API Nest solo en puerto $($env:API_PORT))' -ForegroundColor DarkGray
npm run dev
"@
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd -WindowStyle Normal
    Write-Host "  [OK] Frontend iniciado (ventana nueva)" -ForegroundColor Green
    Start-Sleep -Seconds 8
    $verificar = Join-Path $PSScriptRoot "verificar-puertos.ps1"
    if (Test-Path $verificar) { & $verificar }
}

Write-Host ""
Write-Host "  ----------------------------------------" -ForegroundColor DarkGray
Write-Host "  App (USE ESTA URL): http://localhost:$($env:FRONTEND_PORT)" -ForegroundColor Green
Write-Host "  API (solo NestJS):  http://localhost:$($env:API_PORT)/api/v1" -ForegroundColor DarkGray
Write-Host "  NO abra :$($env:API_PORT) en el navegador para la app." -ForegroundColor Yellow
Write-Host "  Postgres: localhost:$($env:POSTGRES_PORT) | Redis: $($env:REDIS_PORT)" -ForegroundColor DarkGray
Write-Host "  Login:    cedula 1234567890 / Admin123!" -ForegroundColor White
Write-Host "  OTP dev:  ver consola API o usar 000000" -ForegroundColor White
Write-Host "  Detener:  .\scripts\stop-dev.ps1" -ForegroundColor DarkGray
Write-Host "  ----------------------------------------" -ForegroundColor DarkGray
Write-Host ""
