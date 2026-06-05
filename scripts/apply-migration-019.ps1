# Migración 019: NOT_ARRIVED en po_line_fulfillment
$Root = Split-Path -Parent $PSScriptRoot
& (Join-Path $Root "scripts\psql-utf8.ps1") -File (Join-Path $Root "backend/migrations/019_po_line_not_arrived.sql")
