# Reviewing Accessible API Tester

Thanks for taking the time to review this app! This guide explains how to run it
and the specific feedback that would help most.

**What it is:** A Windows desktop app for testing REST APIs (like Postman), built
with accessibility as a first-class goal — full keyboard support and screen-reader
announcements. It supports all 7 HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD,
OPTIONS), authentication, environments/variables, collections, pre/post-request
scripts, and mock endpoints.

---

## Option A — Try the installed app (easiest, no tools needed)

Best if you want to give **usability / UX / accessibility** feedback.

1. Run **`AccessibleApiTester-Setup-1.0.0.exe`**.
2. **Heads-up — SmartScreen warning:** because the installer isn't code-signed yet,
   Windows may show *"Windows protected your PC."* This is expected. Click
   **More info → Run anyway**. (It's safe; it just means we haven't bought a
   signing certificate.)
3. Launch **Accessible API Tester** from the Start Menu.
4. WebView2 (required) is already built into Windows 11; nothing else to install.

You don't need .NET, Node, or any developer tools for this option.

---

## Option B — Run from source (for code review)

Best if you want to review **code quality / architecture**.

**Prerequisites:** [.NET 10 SDK](https://dotnet.microsoft.com/download) and
[Node.js 22+](https://nodejs.org).

```powershell
# 1. Install frontend deps and build the UI (required — wwwroot is generated)
cd ClientApp
npm install
npm run build
cd ..

# 2. Launch the desktop app (web server + WebView2 window)
.\run-desktop.ps1
```

To run it in a browser instead of the desktop window:
```powershell
.\run-desktop.ps1 -Port 5000   # then open http://127.0.0.1:5000
```

**Run the tests:**
```powershell
# Integration tests (no test framework — hand-written assertions)
dotnet run --project Tests\AccessibleApiTester.IntegrationTests.csproj

# Smoke tests (builds, starts the app, hits live endpoints)
powershell -ExecutionPolicy Bypass -File scripts\run-smoke-tests.ps1
```

**Rebuild the installer** (requires [Inno Setup 6](https://jrsoftware.org/isdl.php)):
```powershell
.\publish.ps1
```

See `CLAUDE.md` for the full architecture overview (backend endpoints, storage
layer, frontend structure).

---

## What kind of feedback helps most

Please focus on these — concrete examples and reproduction steps are gold:

1. **Usability** — Is sending a request and reading the response intuitive? Where
   did you get stuck or confused?
2. **Accessibility** — If you use a screen reader (NVDA / JAWS / Narrator), are
   actions announced clearly? Is everything reachable by keyboard alone?
3. **Real-world use** — Did it work against an API *you* actually use? Try auth
   (Bearer / API key / Basic), headers, query params, and variables.
4. **Reliability** — Anything that errored, hung, or behaved unexpectedly. Please
   note the request details (method, URL shape, auth type) if you can.
5. **Missing features** — What would you need before you'd use this regularly?

## How to report

- Bugs: include the steps to reproduce, what you expected, and what happened.
- If you ran from source, the console output / logs are very helpful.
- Screenshots of confusing UI are welcome.

Thank you! 🙏
