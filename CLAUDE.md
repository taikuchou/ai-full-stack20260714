# CLAUDE.md

CMS generated from a SQL Server schema. **`database/*.sql` is the source of truth** — models, DTOs
and nullability derive from it.

## Layout

- `database/` schema (source of truth); `spec/` conventions, build specs, mockups
- `src/CMS.API/` .NET 9 Web API, Dapper (no EF), /swagger
- `src/CMS.API.Tests/` xUnit + Moq (controllers vs mocked repo, no database). Exception: repository
  behaviour needs a real DbConnection — those few tests are `[DatabaseFact]` and skip without the DB
- `src/CMS.NG/` Angular 20 + PrimeNG

## Read when you need it

This file is an index, not a substitute — each doc is the source of truth for its area.

| Doc | Read it when |
|---|---|
| [docs/setup-notes.md](docs/setup-notes.md) | Building, testing, or running anything — env quirks bite here |
| [spec/code-gen.convention.md](spec/code-gen.convention.md) | Scaffolding a feature or touching API/UI structure — **read first**; PK/FK/N-N patterns, routes, auth, app wiring |
| [docs/features.md](docs/features.md) | Touching or extending an existing feature — index of every one, plus auth |
| `spec/{area}/{Entity}.md` | Working on that entity — the fullest source (linked from docs/features.md) |
| [spec/feature-spec.template.md](spec/feature-spec.template.md) + `spec/sample1.spec.md`, `sample2.spec.md` | Writing a new build spec |

`spec/ui-sample-*.png` are style references only.

## Assume by default

The few things you would get wrong *before* knowing to open a doc:

- **Auth is on.** Every endpoint and route is protected already, so a new feature needs **no auth
  wiring**; opting *out* is what takes an explicit `[AllowAnonymous]`. Running locally needs a real
  AppUser login, or the `Auth:Disabled` escape hatch — [docs/setup-notes.md](docs/setup-notes.md).
- **Copy the reference feature, not the nearest one.**
  [spec/code-gen.convention.md](spec/code-gen.convention.md) names one per PK/FK pattern; it also
  says which to avoid.

## Cross-Cutting Conventions

Apply to **every** feature. All of it already exists — wire into it, don't rebuild it.

### Row audit — every repository write is logged

Backend checklist, per repository (`PartnerRepository` = smallest example, `CourseRepository` = FKs + N-N):

- [ ] Inject `IRowAuditWriter` (`CMS.API/Auditing/`); call `LogInsertAsync` / `LogUpdateAsync` /
      `LogDeleteAsync` after the change succeeds. `TableName` is the real table name (`"Course"`).
- [ ] Pass the operation's **own connection + transaction** — the audit row commits with the change,
      so a failed or rolled-back change leaves no audit row. Add a transaction if the method lacks one.
- [ ] **Update: load the "before" row first**, in that same transaction, then log `before, after`.
      Reading on a second connection deadlocks against the transaction's own locks.
- [ ] **Delete: load the row first** — afterwards its first string column is gone.
- [ ] Never insert `pkid` (IDENTITY).

The writer already handles, so don't re-implement: `ActionDesc` (Insert/Delete = the row's first
string-type column value; Update = comma-separated changed column names, truncated at 1000; no
change → **no row**), `PrimaryKeyValues` = pkid as a string, `UserName` = the JWT user → `"system"`,
`DateTime` = UtcNow.

Frontend checklist:

- [ ] **Every detail and form page** places the badge at the **start of the header toolbar** — i.e.
      directly after the `<h1>` inside `.page-title`. (There is no `p-toolbar` in this app;
      `.page-header` is it, and `.page-title` is its start slot. The badge styles its own placement.)
      ```html
      <app-row-audit-badge tableName="Partner" [pkid]="partner().pkid" />
      ```
- [ ] Pass **`null` while adding** — an unsaved row has no history and must not be queried.
- [ ] **AppRole / AppUser: pass the numeric `pkid`**, not RoleId/UserId — the trail is keyed by the
      entity's `pkid` property.
- [ ] A page spec rendering a page with the badge needs `provideHttpClient()` +
      `provideHttpClientTesting()` (the badge fetches on init).

It shows the latest change inline and opens the full trail
(`GET /api/rowaudit?tableName=&pkid=`) on click. **API datetimes are UTC with no offset** — format
via the badge's `parseUtc`; plain `new Date(s)` renders 8 hours early at UTC+8.

Fuller detail, and the one exclusion (FeaturedPromoItem's inline cell editor):
[docs/features.md](docs/features.md) › RowAudit.

### Exception handling — the safety net is global

- [ ] **No per-controller/repository try/catch for unexpected errors.** `GlobalExceptionHandler`
      (`CMS.API/Middleware/`) logs the full detail server-side and returns a generic 500 carrying a
      traceId — never a stack trace, exception message, or SQL. Catch only to *add meaning*, then
      return a deliberate status.
- [ ] **Deliberate responses stay as they are** and never reach the handler: 401/403 from the auth
      pipeline, validation 400s, 404s. Keep returning them from the controller as today.
- [ ] **Frontend errors are surfaced once, globally.** `errorInterceptor` toasts 500-class responses
      (and status 0 = unreachable API) through the root `MessageService` and the shell's
      `<p-toast />`. Don't add per-page handling for server errors; a page's own `<p-toast />` is for
      its own save/load messages.
- [ ] `authInterceptor` owns **401 → logout → /login**. Pages still handle their own 400/404.
