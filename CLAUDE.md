# CLAUDE.md

CMS generated from a SQL Server schema. **`database/*.sql` is the source of truth** — models, DTOs
and nullability derive from it.

## Layout

- `database/` schema (source of truth); `spec/` conventions, build specs, mockups
- `src/CMS.API/` .NET 9 Web API, Dapper (no EF), /swagger
- `src/CMS.API.Tests/` xUnit + Moq (controllers vs mocked repo, no DB). Repository behaviour needs
  a real DbConnection — those few are `[DatabaseFact]` and skip without it
- `src/CMS.NG/` Angular 20 + PrimeNG

## Read when you need it

This file is an index, not a substitute — each doc is the source of truth for its area.

| Doc | Read it when |
|---|---|
| [docs/setup-notes.md](docs/setup-notes.md) | Building, testing, or running anything — env quirks bite here |
| [spec/code-gen.convention.md](spec/code-gen.convention.md) | Scaffolding a feature or touching API/UI structure — **read first**; PK/FK/N-N patterns, routes, auth, app wiring |
| [docs/features.md](docs/features.md) | Touching or extending an existing feature — index of every one, plus the cross-cutting three (auth, RowAudit, error handling) |
| [docs/reading-specs.md](docs/reading-specs.md) | Before trusting anything under `spec/` — which specs are real, and why a dangling pointer proves nothing |
| `spec/{area}/{Entity}.md` | Working on that entity — the fullest source (linked from docs/features.md) |
| [spec/feature-spec.template.md](spec/feature-spec.template.md) | Writing a new build spec |

## Assume by default

The few things you would get wrong *before* knowing to open a doc. The first three already exist
and are wired everywhere: a new feature does not add them, it just avoids re-implementing them.

- **Auth is on.** Every endpoint and route is protected already, so a new feature needs **no auth
  wiring**; opting *out* takes an explicit `[AllowAnonymous]`. Running locally needs a real AppUser
  login, or the `Auth:Disabled` escape hatch — [docs/setup-notes.md](docs/setup-notes.md).
- **Row audit is on** — every repository write is logged. Inject `IRowAuditWriter`
  (`CMS.API/Auditing/`), call it on the operation's **own transaction**, and put
  `<app-row-audit-badge>` after the `<h1>` in `.page-title`. The traps (load-before-update, `null`
  while adding, numeric `pkid` on AppRole/AppUser, UTC datetimes) and the one exclusion:
  [docs/features.md](docs/features.md) › RowAudit.
- **The error safety net is global.** No per-controller try/catch for *unexpected* errors
  (`GlobalExceptionHandler` owns them); no per-page handling of server errors (`errorInterceptor`
  toasts them once). Deliberate 400/401/403/404 stay where they are.
  [docs/features.md](docs/features.md) › Error handling.
- **Copy the reference feature, not the nearest one.**
  [spec/code-gen.convention.md](spec/code-gen.convention.md) names one per PK/FK pattern, and says
  which to avoid.
- **A spec describes intent; only code proves what exists** — and this CMS is not the only consumer
  of its database, so "not in `src/`" does not mean "not built". Check before designing anything
  outward-facing: [docs/reading-specs.md](docs/reading-specs.md).

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
