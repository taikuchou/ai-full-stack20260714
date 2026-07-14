# CMS

Full-stack CMS scaffolded from the database schema in `database/` following the conventions in
`spec/code-gen.convention.md`. First feature implemented: **CRUD AppRole** (角色 / 使用者角色).

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
