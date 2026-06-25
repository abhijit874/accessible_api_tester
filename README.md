# Accessible API Tester

Accessible API Tester is a local web and desktop tool for sending HTTP requests, saving collections, managing variables, and serving mock API responses. It is built with accessibility as a first-class goal — full keyboard support and screen-reader announcements throughout.

## Download (Windows)

Grab the latest installer from the releases page — no developer tools required:

**➡ [Download the latest release](https://github.com/abhijit874/accessible_api_tester/releases/latest)**

1. Download `AccessibleApiTester-Setup-1.0.0.exe`.
2. Windows may show **"Windows protected your PC"** because the installer isn't code-signed yet — click **More info → Run anyway**. This is expected and safe.
3. Launch **Accessible API Tester** from the Start Menu.

Requires Windows 10/11. The Microsoft Edge WebView2 Runtime is already built into Windows 11; nothing else to install.

> The sections below are for **developers** who want to build or run from source.

## Requirements

- .NET 10 SDK
- Node.js 22 or newer, for rebuilding the React client
- Microsoft Edge WebView2 Runtime, for the desktop host
- MySQL is optional

## Run

```powershell
.\run-desktop.ps1
```

The desktop host starts the local web app and opens it inside WebView2. It does not open an external browser. The app uses JSON file storage by default under the user's application data folder. To use MySQL, set `ConnectionStrings:SavedRequests` in `appsettings.json`, user secrets, or an environment-specific configuration file.

## Build

```powershell
dotnet build
cd ClientApp
npm run build
cd ..
dotnet build DesktopHost\AccessibleApiTester.Desktop.csproj
```

## Test

```powershell
dotnet run --project Tests\AccessibleApiTester.IntegrationTests.csproj
powershell -ExecutionPolicy Bypass -File scripts\run-smoke-tests.ps1
```

The integration test runner starts the real app on a local temporary port and uses an isolated temporary storage directory.

## Collection Compatibility

Collections can import Accessible API Tester JSON exports, Postman Collection v2.1 JSON files, and pasted cURL commands. Imported Postman folders are preserved in Collections, and Postman export recreates folder structure. Collections can export either the native JSON format or Postman Collection v2.1 JSON.

## Request Tabs

The Requests screen supports multiple open request tabs. New requests and requests opened from Collections or History each get their own tab with independent draft fields and response output.
