# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Running the app

```powershell
# Desktop host (the only runnable entry point — starts the web server + opens a WebView2 window)
.\run-desktop.ps1

# To use a browser instead of the WebView2 window, run the desktop host on a
# fixed port and open that URL in any browser (the same Kestrel server backs both):
.\run-desktop.ps1 -Port 5000   # then browse to http://127.0.0.1:5000
```

> `AccessibleApiTester.csproj` is `OutputType=Library` (consumed by the desktop host), so it
> **cannot** be started with `dotnet run` directly — `run-desktop.ps1` is the only launcher.

### Frontend development

```powershell
# Start Vite dev server (proxies /api, /oauth, /mock to the .NET backend on port 5000)
cd ClientApp
npm run dev

# Build frontend to wwwroot (required before running the web server without Vite)
npm run build
```

### Tests

```powershell
# Integration tests (starts real app on a free port, isolated temp storage, no test framework)
dotnet run --project Tests\AccessibleApiTester.IntegrationTests.csproj

# Smoke tests (builds app, starts it as a process, hits live endpoints)
powershell -ExecutionPolicy Bypass -File scripts\run-smoke-tests.ps1
```

### Full build

```powershell
dotnet build
cd ClientApp && npm run build && cd ..
dotnet build DesktopHost\AccessibleApiTester.Desktop.csproj
```

## Architecture

### Project layout

| Project | Type | Purpose |
|---|---|---|
| `AccessibleApiTester.csproj` | Library (net10.0) | Core web app — all endpoints, storage, models |
| `DesktopHost/` | WinExe (net10.0-windows) | Windows Forms + WebView2 shell; hosts the web app in-process |
| `Tests/` | Exe (net10.0) | Integration tests — hand-written assertions, no test framework |
| `ClientApp/` | React 19 + Vite | Frontend; builds to `../wwwroot` |

### Backend

**Entry point**: `WebAppFactory.Create()` builds and configures the `WebApplication`. All endpoints are registered via `app.MapApiEndpoints()` in `Endpoints/ApiEndpoints.cs`.

**DI registrations** (all singletons):
- `IAppStateStore` — selects `MySqlRequestStore` if `ConnectionStrings:SavedRequests` is set, otherwise `JsonRequestStore`
- `WorkspaceContext` — tracks the active workspace ID per server session
- Named `HttpClient`s: `"api-tester"` (standard), `"api-tester-no-ssl"` (skips cert validation), `"google-oauth"` (30s timeout); all have `Timeout.InfiniteTimeSpan` except google-oauth, with per-request `CancellationTokenSource` for timeout control in `/api/send`

**Storage layer** (`Storage/`):
- `IAppStateStore` — all CRUD operations scoped to a workspace ID
- `JsonRequestStore` — JSON files, one per workspace, stored under `Storage:Directory` config key
- `MySqlRequestStore` — MySQL-backed, initialized by `MySqlSchemaManager`
- `MySqlSchemaManager` — versioned additive migrations via `EnsureColumnAsync` / `EnsureIndexAsync`; `CurrentSchemaVersion = 10`. To add a new column: increment the constant, add a new `if (appliedVersion < N)` block in `ApplyMigrationsAsync`

**`/api/send` proxy and SSL logic**: When `ProxyUrl` is provided, a dedicated `HttpClientHandler` + `HttpClient` is created per-request (not from factory) and disposed in `finally`. The same handler merges `IgnoreSslErrors` so proxy + SSL bypass compose correctly.

### Frontend

The UI is split into a root component, per-feature panels, shared hooks, and helper/style modules:

- `ClientApp/src/main.jsx` — root `App` component (~1165 lines); owns top-level state, wires hooks, and composes the panels
- `ClientApp/src/panels/` — one component per feature area: `RequestPanel`, `CollectionsPanel`, `VariablesPanel`, `WorkspacePanel`, `EnvironmentsPanel`, `SettingsPanel`, `MocksPanel`
- `ClientApp/src/hooks/` — extracted logic: `useSendRequest`, `useCollectionRunner`, `useCollectionActions`, `useWorkspaceActions`
- `ClientApp/src/components.jsx` — shared presentational components (e.g. `ConfirmPrompt`)
- `ClientApp/src/utils.js` — pure helpers and constants (`emptyRequest`, header/param/form parsing, GraphQL helpers, storage helpers)
- `ClientApp/src/scriptEngine.js` — pre/post request script execution
- `ClientApp/src/importExport.js` — collection/environment import/export (incl. js-yaml)
- `ClientApp/src/styles/` — CSS split by concern, aggregated by `styles/index.css` (`base`, `layout`, `forms`, `request`, `collections`); imported once from `main.jsx`

**Key state groups in `App`**:
- `request` / `emptyRequest` — current request form fields including `timeoutSeconds`, `ignoreSslErrors`, `proxyUrl`
- `response`, `isSending`, `collectionRunResults` — response state
- `collections`, `history`, `environments`, `mocks` — synced to backend via `PUT /api/store` or individual upsert endpoints
- `workspaceId` — drives all backend calls; localStorage key `"accessible-api-tester-workspace"`
- `profiles` — environment profiles, localStorage-only (no backend), keyed per workspace

**Patterns to follow**:
- **Confirmation dialogs**: never use `window.confirm`. Use `requestConfirm(id, message, onConfirm)` + `<ConfirmPrompt pending={pendingConfirm} id="..." onResolve={resolveConfirm} />`. Each confirm site needs a unique `id`.
- **Accessible announcements**: use the `announce(message, type?)` helper for screen-reader feedback on actions.
- **Variable interpolation**: `{{variableName}}` in URL/headers/body, resolved by `resolveVariables(text, variables)` before sending.
- **Workspace-scoped localStorage**: use `workspaceStorageKey(suffix, workspaceId)` to namespace keys per workspace.

### Dual-mode serving

- **Production**: .NET serves `wwwroot/` (the Vite build output) as static files.
- **Development**: Run the .NET backend on port 5000, then `npm run dev` starts Vite on a different port with `/api`, `/oauth`, `/mock` proxied to port 5000 (`vite.config.js`).

### MySQL vs JSON storage

MySQL is optional. Set `ConnectionStrings:SavedRequests` in `appsettings.json` (or user secrets) to activate it. Without it, `JsonRequestStore` writes JSON files to the app data directory. The `IAppStateStore` interface is the same for both — all endpoint code is storage-agnostic.

### Desktop host

`DesktopHost/` wraps the web app in a Windows Forms window with a WebView2 control. It enforces single-instance via a named mutex (`SingleInstanceGuard`). The `wwwroot` folder is referenced via a content link in the csproj so it's copied to the output directory on build.
