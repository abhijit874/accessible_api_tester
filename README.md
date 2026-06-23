# Accessible API Tester

Accessible API Tester is a local web and desktop tool for sending HTTP requests, saving collections, managing variables, and serving mock API responses.

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
