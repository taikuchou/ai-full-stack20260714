# Setup notes

One-time setup context, environment quirks, and build/test/run commands for this repo.
Durable conventions live in [../CLAUDE.md](../CLAUDE.md).

## Environment quirks (important)

- **Windows.** The Bash tool runs Git Bash; the primary shell is PowerShell. Prefer PowerShell for
  toolchain commands.
- **Stale PATH:** Node/dotnet were installed after this Claude Code session's parent process started,
  so `node`/`npm`/`ng` are often NOT on the PATH of shells spawned here. Prefix PowerShell commands with:
  ```powershell
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
  ```
  A freshly opened terminal (outside this session) does not need this.
- **dotnet:** SDK 9 and 10 are both installed. Projects target **net9.0** explicitly — keep it that way.
- **Angular tests need Chrome:** run headless with
  `$env:CHROME_BIN = "C:\Program Files\Google\Chrome\Application\chrome.exe"`.

## Build & test

Backend (from `src/`):
```powershell
dotnet build CMS.slnx
dotnet test  CMS.slnx
```

Frontend (from `src/CMS.NG/`):
```powershell
npx ng build
npx ng test --watch=false --browsers=ChromeHeadless
```

## Run locally

`dotnet run` in `src/CMS.API` (→ http://localhost:5000, Swagger at /swagger) and
`npm start` in `src/CMS.NG` (→ http://localhost:4200).
**End-to-end running requires the `CMS` database on `.\SQLEXPRESS`** built from `database/*.sql`;
builds and unit tests do not.
