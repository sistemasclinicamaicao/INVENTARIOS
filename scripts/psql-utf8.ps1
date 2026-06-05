function Invoke-PsqlFile {
    param(
        [Parameter(Mandatory)][string]$SqlPath,
        [string]$User = "clinica",
        [string]$Database = "clinica_erp",
        [string]$Container = "clinica_erp_postgres"
    )
    if (-not (Test-Path $SqlPath)) {
        throw "No existe: $SqlPath"
    }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $content = [System.IO.File]::ReadAllText($SqlPath, $utf8)
    $content | docker exec -i -e PGCLIENTENCODING=UTF8 $Container psql -U $User -d $Database 2>&1
}
