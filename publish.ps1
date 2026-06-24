<#
.SYNOPSIS
    Builds the frontend, publishes a self-contained Windows build, and (if Inno
    Setup is installed) compiles a single-file installer.

.EXAMPLE
    .\publish.ps1                 # full build + installer
    .\publish.ps1 -SkipInstaller  # just the self-contained app in .\publish
#>
param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [switch]$SelfContained = $true,
    [switch]$SkipInstaller
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$publishDir = Join-Path $root "publish"

Write-Host "==> Building frontend (Vite)..." -ForegroundColor Cyan
Push-Location (Join-Path $root "ClientApp")
try { npm run build } finally { Pop-Location }

Write-Host "==> Publishing self-contained desktop app..." -ForegroundColor Cyan
if (Test-Path $publishDir) { Remove-Item $publishDir -Recurse -Force }
dotnet publish (Join-Path $root "DesktopHost\AccessibleApiTester.Desktop.csproj") `
    -c $Configuration -r $Runtime --self-contained $($SelfContained.IsPresent -or $true) `
    -o $publishDir -nologo
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed." }
Write-Host "    Published to $publishDir" -ForegroundColor Green

if ($SkipInstaller) { Write-Host "Skipping installer (per -SkipInstaller)."; return }

Write-Host "==> Compiling installer (Inno Setup)..." -ForegroundColor Cyan
$iscc = @(
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $iscc) {
    Write-Warning "Inno Setup (ISCC.exe) not found. Install it from https://jrsoftware.org/isdl.php"
    Write-Warning "or run:  winget install --id JRSoftware.InnoSetup -e"
    Write-Warning "The self-contained app is ready in .\publish - re-run this script after installing Inno Setup."
    return
}

& $iscc (Join-Path $root "installer\AccessibleApiTester.iss")
if ($LASTEXITCODE -ne 0) { throw "Inno Setup compilation failed." }
Write-Host "==> Installer created in .\dist" -ForegroundColor Green
