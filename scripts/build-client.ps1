param(
    [string]$NpmCommand = "npm.cmd"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$clientApp = Join-Path $root "ClientApp"

Push-Location $clientApp
try {
    & $NpmCommand run build
} finally {
    Pop-Location
}
