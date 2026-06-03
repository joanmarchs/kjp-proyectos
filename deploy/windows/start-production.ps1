$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")
Set-Location -LiteralPath $ProjectRoot

Write-Host "Building KJP project app..." -ForegroundColor Cyan
npm.cmd run build

Write-Host "Starting production server on http://localhost:3026" -ForegroundColor Green
npm.cmd run start:prod
