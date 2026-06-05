# Establece password_hash demo (Admin123!) en usuarios 1234567890 y 9876543210
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (Test-Path (Join-Path $Root ".env")) {
    Get-Content (Join-Path $Root ".env") | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

$sql = Join-Path $Root "backend\migrations\028_demo_password_hashes.sql"
$dbUrl = $env:DATABASE_URL

Write-Host "Aplicando migracion 028 (password demo Admin123!)..." -ForegroundColor Cyan

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
    Write-Host "[OK] Migracion 028 aplicada" -ForegroundColor Green
    Write-Host "  Login: 1234567890 / Admin123! (OTP por correo si SMTP activo)" -ForegroundColor Gray
} else {
    Write-Host "[ERROR] Revise DATABASE_URL en .env o contenedor postgres local" -ForegroundColor Red
    exit 1
}
