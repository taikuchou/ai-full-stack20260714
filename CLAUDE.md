# CLAUDE.md

## What this is

CMS generated from a SQL Server schema. **`database/*.sql` is the source of truth** — models, DTOs
and nullability derive from it.

## Layout

- `database/` schema (source of truth); `spec/` conventions, build specs, mockups
- `src/CMS.API/` .NET 9 Web API, Dapper (no EF), /swagger
- `src/CMS.API.Tests/` xUnit + Moq (controllers vs mocked repo)
- `src/CMS.NG/` Angular 20 + PrimeNG

## Read when you need it

| Doc | Read it when |
|---|---|
| [docs/setup-notes.md](docs/setup-notes.md) | Building, testing, or running anything — env quirks bite here |
| [spec/code-gen.convention.md](spec/code-gen.convention.md) | Scaffolding a feature — **read first**; PK/FK/N-N patterns |
| [docs/features.md](docs/features.md) | Touching or extending an existing feature |
| `spec/{area}/{Entity}.md` | Working on that entity — the fullest source (see index below) |
| `spec/sample1.spec.md`, `sample2.spec.md` | Writing a new build spec (samples) |
| `spec/feature-spec.template.md` | Writing a new build spec (template) |

`spec/ui-sample-*.png` are style references only.

## Conventions in brief

Full detail in `spec/code-gen.convention.md`.

**Backend** — per entity: `{Entity}.cs`, `{Entity}Request.cs` (write), `{Entity}Query.cs` (search),
`I{Entity}Repository` + `{Entity}Repository` (Dapper). Routes `GET /api/{plural}`,
`POST /api/{plural}/query`, `GET/POST/PUT/DELETE`; **PUT takes its key from the body**. Lookups
`GET /api/lookups/{plural}`. `nchar(n)` → `RTRIM()` in SELECTs. `DateOnly`/`TimeOnly` handlers live
in `Program.cs`. `IDbConnectionFactory` reads `ConnectionStrings:CMS`; CORS from
`Cors:AllowedOrigins`.

**Frontend** — components under `features/{plural}/{entity}-list|-detail|-form/`; shared code in
`core/models/`, `core/services/`. List = `p-table` + `p-drawer` filter with session-storage
`{entity}-list-filters`/`-sort`/`-page`. Form = reactive, `forkJoin` lookups, `p-multiselect` for
n-n. API URL from `environment.ts`/`.development.ts` (`fileReplacements`); import `@env/environment`.
Theme `Aura` in `app.config.ts`; shell = Ultima; menu = `sections` signal; topbar brand text
(`app.html` `.logo-text`) = `CMS`.

## Implemented features

Each row names the PK pattern it exemplifies — copy the closest match when scaffolding. Detail in
[docs/features.md](docs/features.md).

| Entity | 中文 | PK pattern | Nav | Spec |
|---|---|---|---|---|
| AppRole | 角色 | string (`RoleId`) | 系統管理 › 角色 | *(none — mirror the code)* |
| AppUser | 使用者 | string (`UserId`) | 系統管理 › 使用者 | [auth/AppUser.md](spec/auth/AppUser.md) |
| PublishStatus | 發布狀態 | `tinyint`, user-assigned | 系統管理 › 發布狀態 | [admin/PublishStatus.md](spec/admin/PublishStatus.md) |
| Partner | 合作廠商 | `smallint IDENTITY` | 課程管理 › 合作廠商 | [course/Partner.md](spec/course/Partner.md) |
| CourseGroup | 課程群組 | `smallint IDENTITY` | 課程管理 › 課程群組 | [course/CourseGroup.md](spec/course/CourseGroup.md) |
| Course | 課程 | `int IDENTITY` | 課程管理 › 課程 | [course/Course.md](spec/course/Course.md) |

All six are full CRUD. **Course** is the only FK-bearing entity and the only one with N-N beyond the
AppRole↔AppUser junction — copy it for anything with foreign keys.

Nav links from a built entity to an unbuilt one are **deferred until the target feature exists**.
