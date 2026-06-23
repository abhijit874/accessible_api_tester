param(
    [int]$Port = 5095,
    [string]$Configuration = "Debug"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dll = Join-Path $root "bin\$Configuration\net10.0\AccessibleApiTester.dll"
$baseUrl = "http://127.0.0.1:$Port"
$stdoutLog = Join-Path $root "smoke-test.out.log"
$stderrLog = Join-Path $root "smoke-test.err.log"
$process = $null
$originalState = $null

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Invoke-Json {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [object]$Body = $null,
        [int]$TimeoutSec = 15
    )

    $parameters = @{
        Uri = $Uri
        Method = $Method
        TimeoutSec = $TimeoutSec
    }

    if ($null -ne $Body) {
        $parameters.ContentType = "application/json"
        $parameters.Body = ($Body | ConvertTo-Json -Depth 10)
    }

    Invoke-RestMethod @parameters
}

function Wait-ForApp {
    for ($i = 0; $i -lt 40; $i++) {
        if ($null -ne $process -and $process.HasExited) {
            break
        }

        try {
            return Invoke-Json -Uri "$baseUrl/api/store" -TimeoutSec 3
        } catch {
            Start-Sleep -Milliseconds 300
        }
    }

    if (Test-Path -LiteralPath $stdoutLog) {
        Write-Host "--- app stdout ---"
        Get-Content -LiteralPath $stdoutLog | Out-Host
    }

    if (Test-Path -LiteralPath $stderrLog) {
        Write-Host "--- app stderr ---"
        Get-Content -LiteralPath $stderrLog | Out-Host
    }

    throw "App did not start on $baseUrl."
}

try {
    Push-Location $root
    try {
        dotnet build -c $Configuration | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "dotnet build failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }

    Assert-True (Test-Path -LiteralPath $dll) "Built app DLL was not found at $dll."

    Remove-Item -LiteralPath $stdoutLog,$stderrLog -Force -ErrorAction SilentlyContinue
    $process = Start-Process -FilePath dotnet `
        -ArgumentList @("`"$dll`"", "--urls", $baseUrl) `
        -WorkingDirectory $root `
        -PassThru `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog
    $originalState = Wait-ForApp

    $homeResponse = Invoke-WebRequest -Uri "$baseUrl/" -TimeoutSec 10 -UseBasicParsing
    Assert-True ($homeResponse.StatusCode -eq 200) "Home page did not return HTTP 200."
    Assert-True ($homeResponse.Content -like "*Accessible API Tester*") "Home page did not contain the app title."

    $testState = @{
        history = @(
            @{
                id = "smoke-history"
                method = "GET"
                url = "http://example.com/"
                headers = ""
                contentType = "application/json"
                body = ""
                status = 200
                time = "2026-04-22T00:00:00.000Z"
            }
        )
        collections = @(
            @{
                id = "smoke-collection"
                name = "Smoke test request"
                method = "GET"
                url = "{{baseUrl}}/todos/1"
                headers = "Accept: application/json"
                contentType = "application/json"
                body = ""
                updatedAt = "2026-04-22T00:00:00.000Z"
            }
        )
        environments = @(
            @{
                id = "smoke-env"
                name = "baseUrl"
                value = "https://jsonplaceholder.typicode.com"
                updatedAt = "2026-04-22T00:00:00.000Z"
            }
        )
        mocks = @(
            @{
                id = "smoke-mock"
                name = "Smoke mock"
                method = "GET"
                path = "/smoke"
                statusCode = 201
                contentType = "application/json"
                headers = "X-Smoke: yes"
                body = "{`"ok`":true}"
                updatedAt = "2026-04-22T00:00:00.000Z"
            }
        )
    }

    Invoke-Json -Uri "$baseUrl/api/store" -Method "PUT" -Body $testState -TimeoutSec 15 | Out-Null
    $savedState = Invoke-Json -Uri "$baseUrl/api/store" -TimeoutSec 15
    Assert-True (@($savedState.history).Count -eq 1) "History was not saved."
    Assert-True (@($savedState.collections).Count -eq 1) "Collections were not saved."
    Assert-True (@($savedState.environments).Count -eq 1) "Variables were not saved."
    Assert-True (@($savedState.mocks).Count -eq 1) "Mocks were not saved."
    Assert-True ($savedState.environments[0].name -eq "baseUrl") "Saved variable name did not round-trip."

    $mockResponse = Invoke-WebRequest -Uri "$baseUrl/mock/smoke" -TimeoutSec 15 -UseBasicParsing
    Assert-True ($mockResponse.StatusCode -eq 201) "Mock route did not return the configured status."
    Assert-True ($mockResponse.Content -eq "{`"ok`":true}") "Mock route did not return the configured body."
    Assert-True ($mockResponse.Headers["X-Smoke"] -eq "yes") "Mock route did not return the configured header."

    try {
        $badRequest = @{
            method = "GET"
            url = "not-a-url"
            headers = @()
            body = ""
            contentType = "application/json"
        }
        Invoke-Json -Uri "$baseUrl/api/send" -Method "POST" -Body $badRequest -TimeoutSec 15 | Out-Null
        throw "Invalid URL request unexpectedly succeeded."
    } catch {
        $response = $_.Exception.Response
        Assert-True ($null -ne $response) "Invalid URL did not return an HTTP error response."
        Assert-True ([int]$response.StatusCode -eq 400) "Invalid URL did not return HTTP 400."
    }

    $validRequest = @{
        method = "GET"
        url = "http://example.com/"
        headers = @()
        body = ""
        contentType = "application/json"
    }
    $sendResponse = Invoke-Json -Uri "$baseUrl/api/send" -Method "POST" -Body $validRequest -TimeoutSec 30
    Assert-True ($sendResponse.status -ge 200) "Send response did not include a valid status code."
    Assert-True ($null -ne $sendResponse.headers) "Send response did not include headers."

    Write-Host "Smoke tests passed."
} finally {
    if ($null -ne $originalState) {
        try {
            Invoke-Json -Uri "$baseUrl/api/store" -Method "PUT" -Body @{
                history = @($originalState.history)
                collections = @($originalState.collections)
                environments = @($originalState.environments)
                mocks = @($originalState.mocks)
            } -TimeoutSec 15 | Out-Null
        } catch {
            Write-Warning "Could not restore original app state: $($_.Exception.Message)"
        }
    }

    if ($null -ne $process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }

    Remove-Item -LiteralPath $stdoutLog,$stderrLog -Force -ErrorAction SilentlyContinue
}
