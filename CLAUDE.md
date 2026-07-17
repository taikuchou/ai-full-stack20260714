# CLAUDE.md

CMS generated from a SQL Server schema. **`database/*.sql` is the source of truth** — models, DTOs
and nullability derive from it.

## Layout

- `database/` schema (source of truth); `spec/` conventions, build specs, mockups
- `src/CMS.API/` .NET 9 Web API, Dapper (no EF), /swagger
- `src/CMS.API.Tests/` xUnit + Moq (controllers vs mocked repo, no DB). Repository behaviour needs a
  real DbConnection — those few are `[DatabaseFact]` and skip without it
- `src/CMS.NG/` Angular 20 + PrimeNG

## Read when you need it

This file is an index, not a substitute — each doc is the source of truth for its area.

| Doc | Read it when |
|---|---|
| [docs/setup-notes.md](docs/setup-notes.md) | Building, testing, or running — env quirks bite here |
| [spec/code-gen.convention.md](spec/code-gen.convention.md) | Scaffolding a feature or touching API/UI structure — **read first**; PK/FK/N-N patterns, routes, auth, wiring |
| [docs/features.md](docs/features.md) | Touching an existing feature — index of every one, plus the cross-cutting three (auth, RowAudit, error handling) and the **Security posture** section |
| [TODOS.md](TODOS.md) › Security | Security review / auth / hardening — the `/cso` audit backlog (deferred, labelled) lives here |
| [docs/reading-specs.md](docs/reading-specs.md) | Before trusting anything under `spec/` — which specs are real |
| `spec/{area}/{Entity}.md` | Working on that entity — the fullest source (linked from features.md) |
| [spec/feature-spec.template.md](spec/feature-spec.template.md) | Writing a new build spec |

## Assume by default

The few things you'd get wrong *before* knowing to open a doc. The first three already exist and are
wired everywhere — a new feature reuses them, it doesn't re-implement them.

- **Auth is on.** Every endpoint and route is already protected; a new feature adds no auth wiring.
  Opting out takes an explicit `[AllowAnonymous]`. Local run needs a real AppUser login or the
  `Auth:Disabled` escape hatch → setup-notes.
- **Row audit is on** — every repository write is logged. Inject `IRowAuditWriter`
  (`CMS.API/Auditing/`), call it on the operation's **own transaction**, and put
  `<app-row-audit-badge>` after `<h1>` in `.page-title`. Traps + the one exclusion → features.md ›
  RowAudit.
- **Error safety net is global.** No per-controller try/catch for *unexpected* errors
  (`GlobalExceptionHandler`); no per-page handling of server errors (`errorInterceptor` toasts once).
  Deliberate 400/401/403/404 stay put → features.md › Error handling.
- **Copy the reference feature, not the nearest one** — code-gen.convention.md names one per PK/FK
  pattern and which to avoid.
- **A spec is intent; only code proves what exists.** This CMS isn't the DB's only consumer, so "not
  in `src/`" ≠ "not built". Check before designing anything outward-facing → reading-specs.md.
- **Angular is XSS-safe by default.** `[innerHTML]` (including PrimeNG's ConfirmDialog `message`) is
  sanitized unless something calls `bypassSecurityTrust*` — grep for that before rating any innerHTML as
  script-XSS. Full context + the `/cso` audit posture → features.md › Security posture.

## Skill routing

Match the request to an available skill and invoke it via the Skill tool — when in doubt, invoke.
Skill descriptions are already in context; non-obvious mappings: product ideas → /office-hours;
strategy → /plan-ceo-review; architecture → /plan-eng-review; full pipeline → /autoplan; bugs →
/investigate; QA → /qa or /qa-only; code review → /review; visual polish → /design-review; ship →
/ship or /land-and-deploy; save/resume context → /context-save, /context-restore; author a spec →
/spec.
