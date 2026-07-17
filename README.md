# CMS

Full-stack CMS scaffolded from the database schema in `database/` following the conventions in
`spec/code-gen.convention.md`. Seven full CRUD features (AppRole, AppUser, PublishStatus, Partner,
CourseGroup, Course, FeaturedPromoItem) plus auth, RowAudit, and global error handling —
see [docs/features.md](docs/features.md) for the full index. The AppRole endpoints below are kept
as a worked example of the conventions.

## Layout

```
database/            SQL Server schema (source of truth)
spec/                Coding + UI conventions, feature-spec samples
src/
  CMS.slnx           .NET solution (API + tests)
  CMS.API/           .NET 9 Web API (Dapper, no EF) — port 5000, Swagger at /swagger
  CMS.API.Tests/     xUnit + Moq tests for the AppRole endpoints
  CMS.NG/            Angular 20 (standalone) + PrimeNG frontend — port 4200
```

## Prerequisites

- .NET SDK 9
- Node.js LTS + npm
- SQL Server Express with the **CMS** database created from `database/*.sql`
  (connection string in `src/CMS.API/appsettings.json`:
  `Server=.\SQLEXPRESS;Database=CMS;Trusted_Connection=True;TrustServerCertificate=True;Encrypt=False`)

## Backend — CMS.API

```bash
cd src/CMS.API
dotnet run           # http://localhost:5000  (Swagger UI: http://localhost:5000/swagger)
```

Tests:

```bash
cd src
dotnet test CMS.slnx
```

### AppRole endpoints

| Method | Route                     | Description                          |
|--------|---------------------------|--------------------------------------|
| GET    | `/api/approles`           | All roles (with user counts)         |
| POST   | `/api/approles/query`     | Filtered search (`AppRoleQuery`)     |
| GET    | `/api/approles/{id}`      | Single role by RoleId (+ assigned users) |
| POST   | `/api/approles`           | Create                               |
| PUT    | `/api/approles`           | Update (RoleId in body)              |
| DELETE | `/api/approles/{id}`      | Delete                               |
| GET    | `/api/lookups/appusers`   | AppUser options for the assignment multiselect |

`AppRole` uses the string primary key `RoleId`; `pkid` (IDENTITY) is surfaced for display only.
The `AppUserRole` junction table drives the user-count column and the users multiselect
(delete-then-reinsert sync on save).

## Frontend — CMS.NG

```bash
cd src/CMS.NG
npm install          # first time only (already run)
npm start            # ng serve on http://localhost:4200
```

Tests (Karma + Jasmine, headless):

```bash
cd src/CMS.NG
npm test -- --watch=false --browsers=ChromeHeadless
```

- API base URL comes from `src/environments/environment*.ts` (no dev proxy).
  `@env/environment` path alias configured in `tsconfig.json`.
- Sidebar nav: **系統管理 Admin › 角色 AppRole**.
- Routes: `/app-roles` (list), `/app-roles/new` (add), `/app-roles/:id` (view),
  `/app-roles/:id/edit` (edit).

## Security

Every endpoint and route is behind auth by default (JWT bearer; global `AuthorizeFilter`). The project
was audited end-to-end with `/cso` on 2026-07-17: the two prior real vulnerabilities (privilege
escalation, CourseGroup cascade data-loss) are fixed and tested, and no new exploitable finding
survived. Residual hardening items (login rate-limit/lockout over unsalted SHA-256, unconditional
Swagger, `Encrypt=False` to SQL Server, and a few client-side notes) are deferred and tracked in
[TODOS.md](TODOS.md) › Security, with the full report under `.gstack/security-reports/` (gitignored).
See [docs/features.md](docs/features.md) › Security posture for the details, including why the
PrimeNG confirm-dialog `[innerHTML]` is not an XSS.
