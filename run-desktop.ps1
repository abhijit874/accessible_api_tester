param(
    [int]$Port = 5090,
    [string]$Configuration = "Debug"
)

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$project = Join-Path $root "DesktopHost\AccessibleApiTester.Desktop.csproj"
$url = "http://127.0.0.1:$Port"

Push-Location $root
try {
    dotnet run --project $project -c $Configuration -- --urls $url
} finally {
    Pop-Location
}
