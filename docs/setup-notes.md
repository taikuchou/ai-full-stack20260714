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

## Authentication: login enforced

**Login is on and enforced, including locally.** `POST /api/auth/login` issues a 24h JWT; a global
`AuthorizeFilter` plus JWT bearer validation reject every other endpoint without one, and `authGuard`
sends unauthenticated users to `/login`. See [features.md](features.md) for the endpoint contract.

Running the app therefore **requires a real AppUser account** — `ng serve` lands on the login screen
and every request 401s until you sign in. Seeded accounts live in `AppUser`; a forgotten password is
recoverable by overwriting `PasswordHash` with the SHA-256 (uppercase hex) of a known string, since
the reset-password endpoint is itself behind auth.

**The `Auth:Disabled` escape hatch.** `appsettings.Development.json` has `Auth:Disabled` and the
client has `authDisabled` in `environment.development.ts`. Both are **false**. Setting them bypasses
auth for local work — but they must be **set together**: flipping only the client bypasses the login
screen while every API call still 401s, and flipping only the API leaves a login screen you cannot
skip. They were both `true` before 2026-07-15, which is why login appeared to "not work" locally.

`PasswordHasher` (`CMS.API/Security/`) **survived the removal** — it is not auth infrastructure here.
`AppUserRepository` uses it to hash the default password on AppUser create and reset-password, so it
stays regardless of whether login exists.
