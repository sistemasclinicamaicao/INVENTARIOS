# Importa listados INVIMA (xlsx) a PostgreSQL vía Nest CLI
param(
    [string]$File,
    [ValidateSet('VIGENTE', 'VENCIDO', 'RENOVACION', 'OTRO_ESTADO')]
    [string]$ListType,
    [string]$DataDir = "data\invima",
    [switch]$SkipCopy
)

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (Test-Path (Join-Path $Root ".env")) {
    Get-Content (Join-Path $Root ".env") | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

$destDir = Join-Path $Root $DataDir
if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

if (-not $SkipCopy) {
    $sources = @(
        "$env:USERPROFILE\Downloads\ListadoCodigoUnicoVigentes2022.xlsx",
        "$env:USERPROFILE\Downloads\ListadoCodigoUnicoVencidos2022.xlsx",
        "$env:USERPROFILE\Downloads\ListadoCodigoUnicoRenovacion2022.xlsx",
        "$env:USERPROFILE\Downloads\ListadoCodigounicoOtrosEstado2022.xlsx"
    )
    foreach ($src in $sources) {
        if (Test-Path $src) {
            $name = Split-Path $src -Leaf
            Copy-Item $src (Join-Path $destDir $name) -Force
            Write-Host "[OK] Copiado $name -> $DataDir" -ForegroundColor Green
        }
    }
}

$migration = Join-Path $Root "backend\migrations\006_invima_reference.sql"
$check = docker exec clinica_erp_postgres psql -U clinica -d clinica_erp -tAc "SELECT 1 FROM pg_tables WHERE tablename='invima_registros'" 2>$null
if ($check -notmatch '1') {
    Write-Host "Aplicando migracion 006..." -ForegroundColor Cyan
    & (Join-Path $Root "scripts\apply-migration-006.ps1")
}

Push-Location (Join-Path $Root "backend")
npm run build 2>&1 | Out-Null
if ($File) {
    $absFile = if ([System.IO.Path]::IsPathRooted($File)) { $File } else { Join-Path $Root $File }
    if (-not (Test-Path $absFile)) {
        Write-Host "[ERROR] No existe: $absFile" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    $args = @("dist/scripts/import-invima-cli.js", "--file", $absFile)
    if ($ListType) { $args += @("--list-type", $ListType) }
    Write-Host "Importando $absFile ..." -ForegroundColor Cyan
    node @args
    $code = $LASTEXITCODE
} else {
    Write-Host "Importando los 4 xlsx desde $destDir ..." -ForegroundColor Cyan
    node dist/scripts/import-invima-cli.js $destDir
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        Write-Host "[AVISO] Revise que los 4 archivos esten en $DataDir (ver data/invima/README.md)" -ForegroundColor Yellow
    }
}
Pop-Location
exit $code
