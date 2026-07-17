# Agent notes

Working conventions for AI agents that don't need to sit in the always-loaded
[CLAUDE.md](../CLAUDE.md). CLAUDE.md stays the index; this is the overflow it points at.

## Skill routing

Match the request to an available skill and invoke it via the Skill tool — when in doubt, invoke.
Skill descriptions are already in context, so this is only the non-obvious mappings:

| Request | Skill |
|---|---|
| product ideas | `/office-hours` |
| strategy | `/plan-ceo-review` |
| architecture | `/plan-eng-review` |
| full pipeline | `/autoplan` |
| bugs | `/investigate` |
| QA | `/qa` or `/qa-only` |
| code review | `/review` |
| visual polish | `/design-review` |
| ship | `/ship` or `/land-and-deploy` |
| save / resume context | `/context-save`, `/context-restore` |
| author a spec | `/spec` |
