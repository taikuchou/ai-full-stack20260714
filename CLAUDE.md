# CLAUDE.md

CMS generated from a SQL Server schema. **`database/*.sql` is the source of truth** — models, DTOs
and nullability derive from it.

## Layout

- `database/` schema (source of truth); `spec/` conventions, build specs, mockups
- `src/CMS.API/` .NET 9 Web API, Dapper (no EF), /swagger
- `src/CMS.API.Tests/` xUnit + Moq (controllers vs mocked repo, no database)
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
