# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A full-stack CMS generated from a SQL Server schema. The **schema in `database/*.sql` is the
source of truth**; models, DTOs, and required/nullable fields are derived from it. Feature scope
and behavior follow `spec/code-gen.convention.md` (read it before adding a feature) and the sample
specs `spec/sample1.spec.md` (complex entity) and `spec/sample2.spec.md` (simple entity).

The `spec/ui-sample-*.png` images are **style references** for layout/look, not a source of data.

## Layout

```
database/            SQL Server schema — source of truth
spec/                Conventions, feature-spec template, worked samples, UI mockups
src/
  CMS.slnx           .NET solution (API + tests). NOTE: .slnx (XML), created by the .NET 10 SDK.
  CMS.API/           .NET 9 Web API — Dapper (no EF), async, Swagger at /swagger, port 5000
  CMS.API.Tests/     xUnit + Moq (controllers tested against a mocked repository — no DB needed)
  CMS.NG/            Angular 20 standalone + PrimeNG — port 4200, Karma/Jasmine tests
```

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

Run locally: `dotnet run` in `src/CMS.API` (→ http://localhost:5000, Swagger at /swagger) and
`npm start` in `src/CMS.NG` (→ http://localhost:4200).
**End-to-end running requires the `CMS` database on `.\SQLEXPRESS`** built from `database/*.sql`;
builds and unit tests do not.

## Backend conventions (as implemented)

- Per entity: `Models/{Entity}.cs` (response, with nav/count fields), `{Entity}Request.cs` (write DTO),
  `{Entity}Query.cs` (search DTO). Repository pair `I{Entity}Repository` + `{Entity}Repository` (Dapper).
- Endpoints: `GET /api/{plural}`, `POST /api/{plural}/query`, `GET/POST/PUT/DELETE`. **PUT takes the key
  from the body**, no route param. Lookups under `GET /api/lookups/{plural}`.
- **String PK** (e.g. `AppRole.RoleId`): controller route uses `{id}` (no `:int`); the Angular service
  calls `encodeURIComponent(id)`. Any IDENTITY `pkid` alongside a string PK is display-only.
- **N-N** (e.g. `AppUserRole`): delete-then-reinsert inside a transaction on create/update; counts via
  correlated subquery; a separate read populates the id list on GET-by-id.
- `nchar(n)` columns: always `RTRIM()` in SELECTs. `DateOnly`/`TimeOnly` handlers are registered in
  `Program.cs` (`Data/TypeHandlers/`).
- Connection via `IDbConnectionFactory` (singleton) reading `ConnectionStrings:CMS`. CORS origins from
  `Cors:AllowedOrigins` in `appsettings.json`.

## Frontend conventions (as implemented)

- Standalone components under `features/{plural}/{entity}-list|-detail|-form/`. Core code in
  `core/models/` and `core/services/`.
- List: `p-table` (sortable/paginated) + `p-drawer` filter; session-storage keys
  `{entity}-list-filters` / `-sort` / `-page`. Form: reactive forms, `forkJoin` for parallel lookups,
  `p-multiselect` for n-n. String-PK field is disabled in edit mode.
- API base URL from `src/environments/environment.ts` (prod) / `environment.development.ts` (dev, swapped
  via `fileReplacements` in `angular.json`). No dev proxy. Import via the **`@env/environment`** alias
  (configured in `tsconfig.json` `paths`).
- PrimeNG theming via `providePrimeNG({ theme: { preset: Aura } })` in `app.config.ts`; `primeicons.css`
  is in `angular.json` styles. Component-scoped `ConfirmationService`/`MessageService` are resolved from
  the component injector in tests (not `TestBed.inject`).
- App shell (`app.ts`/`app.html`/`app.scss`) is styled after the **Ultima** PrimeNG template
  (https://ultima.primeng.org): dark topbar with the logo + collapse toggle, light sidebar with
  uppercase section headers, icon+label rows, indigo active state (rounded highlight), expandable
  items with a rotating chevron + indented submenu, and a user-profile footer. Menu data is the
  `sections` signal (section header → items → optional children); add new features under the right section.

## Implemented features

- **AppRole** (角色) — full CRUD. String PK `RoleId`; N-N to `AppUser` via `AppUserRole` (user-count
  column + users multiselect). Nav: 系統管理 Admin › 角色 AppRole.
