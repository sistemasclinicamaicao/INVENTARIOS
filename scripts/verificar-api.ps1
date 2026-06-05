# Prueba rápida de rutas API (requiere API en API_PORT)
$Root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $Root ".env"
$apiPort = 3050
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*API_PORT=(\d+)') { $apiPort = [int]$matches[1] }
    }
}

$base = "http://127.0.0.1:$apiPort/api/v1"
$routes = @('/health', '/masters/products', '/purchases/suppliers', '/dashboard/stats')

Write-Host "API: $base" -ForegroundColor Cyan
foreach ($path in $routes) {
    try {
        $r = Invoke-WebRequest -Uri "$base$path" -TimeoutSec 10 -UseBasicParsing
        Write-Host "  OK $($r.StatusCode) $path" -ForegroundColor Green
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "  $code $path" -ForegroundColor $(if ($code -eq 401) { 'Yellow' } else { 'Red' })
    }
}
