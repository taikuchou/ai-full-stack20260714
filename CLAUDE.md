# CLAUDE.md

CMS generated from a SQL Server schema. **`database/*.sql` is the source of truth** — models, DTOs
and nullability derive from it. This file is an index, not a substitute; each linked doc owns its area.

## Layout

- `database/` schema (source of truth); `spec/` conventions, build specs, mockups
- `src/CMS.API/` .NET 9 Web API, Dapper (no EF), /swagger
- `src/CMS.API.Tests/` xUnit + Moq (controllers vs mocked repo, no DB); repo behaviour needs a real
  DbConnection → those are `[DatabaseFact]`, skip without it
- `src/CMS.NG/` Angular 20 + PrimeNG

## Read when you need it

| Doc | Read it when |
|---|---|
| [docs/setup-notes.md](docs/setup-notes.md) | Building, testing, running — env quirks bite here |
| [spec/code-gen.convention.md](spec/code-gen.convention.md) | Scaffolding / touching API/UI structure — **read first**; PK/FK/N-N, routes, auth, wiring |
| [docs/features.md](docs/features.md) | Touching a feature — index of every one, plus auth / RowAudit / error handling / Security posture |
| [TODOS.md](TODOS.md) › Security | Security / auth / hardening — the `/cso` deferred backlog |
| [docs/reading-specs.md](docs/reading-specs.md) | Before trusting anything under `spec/` — which specs are real |
| [docs/agent-notes.md](docs/agent-notes.md) | Skill routing and other agent conventions |
| `spec/{area}/{Entity}.md` | Working an entity — the fullest source (linked from features.md) |
| [spec/feature-spec.template.md](spec/feature-spec.template.md) | Writing a new build spec |

## Assume by default

The few things you'd get wrong *before* knowing to open a doc. The cross-cutting three already exist
and are wired everywhere — a new feature reuses them, it doesn't re-implement them.

- **Auth is on.** Every endpoint/route is protected; a new feature adds no auth wiring. Opt out with an
  explicit `[AllowAnonymous]`. Local run needs a real AppUser login or the `Auth:Disabled` hatch → setup-notes.
- **Row audit is on.** Inject `IRowAuditWriter` (`CMS.API/Auditing/`), call it on the operation's **own
  transaction**, and put `<app-row-audit-badge>` after `<h1>` in `.page-title` → features.md › RowAudit.
- **Error safety net is global.** No per-controller try/catch for *unexpected* errors
  (`GlobalExceptionHandler`); no per-page server-error handling (`errorInterceptor`). Deliberate
  400/401/403/404 stay put → features.md › Error handling.
- **Copy the reference feature**, not the nearest one — code-gen.convention.md names one per PK/FK pattern.
- **A spec is intent; only code proves what exists.** "Not in `src/`" ≠ "not built" → reading-specs.md.
- **Angular is XSS-safe by default.** `[innerHTML]` (incl. PrimeNG ConfirmDialog `message`) is sanitized
  unless something calls `bypassSecurityTrust*` — grep for that before rating any innerHTML as script-XSS
  → features.md › Security posture.

## Skill routing

Match the request to an available skill and invoke it via the Skill tool — when in doubt, invoke.
Non-obvious mappings: [docs/agent-notes.md](docs/agent-notes.md).
