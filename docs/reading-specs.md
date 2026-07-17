# Reading the specs

`spec/` holds conventions, build specs and mockups. It is **not** uniformly true of this repo.
Some entries describe shipped code, some describe intent that was never built, and at least one
describes something that *is* built — somewhere else. This page says which is which, and how to
tell.

Durable conventions live in [../CLAUDE.md](../CLAUDE.md); this is the source of truth for how much
to trust a spec file.

## The one rule

> **A spec describes intent. Only code proves what exists. Check the code — and check where.**

## `spec/sample*.spec.md` are not templates

`CLAUDE.md` once presented them as examples for authoring new specs. They are not. Read them as
**evidence, not instructions**.

**`sample1.spec.md` is a partially-implemented spec of the real Course feature.** Its entries fall
into three categories — and every one of them carries the *same* dangling
`See spec/course/Course.md` pointer:

| Entry | Reality |
|---|---|
| `### List — Lookup Binding` (`:397`) | **Built here.** Describes the `forkJoin` lookup resolution in `course-detail.ts` accurately |
| `### Detail — Inline QR Code` (`:401`) | **Built here.** Live in production, inside the 基本資料 card exactly as described |
| `### Detail — 列印PDF` (`:405`) | **Built — but NOT in this repo.** See below |
| `POST /api/courses/{id}/copy` | **Never built.** |

**`sample2.spec.md` describes an entity that does not exist.**

Two consequences:

- **A dangling reference tells you nothing about whether something is built.** All four entries
  above point at the same non-existent file. One shipped here, one shipped elsewhere, one never
  shipped.
- **`spec/course/Course.md` documents neither the QR nor the print capability**, though both are
  real. A spec's silence is not evidence of absence either.

## "Not in this repo" ≠ "not built" — the 列印PDF lesson

This one cost two days of planning on 2026-07-16, so it is worth stating plainly.

`sample1.spec.md:405` reads: *"列印PDF — `window.print()` via a toolbar button."* A design session
read that as unbuilt — reasonably, since `window.print()` appears nowhere in `src/`, there is no
`@media print` in any stylesheet, and no PDF library in `package.json` or `CMS.API.csproj`. All
true. It then designed a ~2-day `course-sheet` route to build it.

**It already existed.** The public course page at
`https://www.uuu.com.tw/Course/Show/{Course.Pkid}/{CourseId}` — the page this CMS's own QR code
points at — has a **友善列印 ("Printer-Friendly") button** wired to `window.print()`, backed by a
purpose-built `printCourse.css`, shipped around 2017. The company owns that site. The planned
feature would have been a worse copy of it.

**The generalisable trap:** this CMS is not the only consumer of its database. `Course` rows are
rendered by the public site too. Before designing anything *outward-facing* — a document, an
export, a print view, a shareable link — **check the public site first.** Greenfield in `src/` does
not mean greenfield in the org.

Where the CMS *does* touch this, it links rather than rebuilds: `course-detail` has a 友善列印
button that opens the public page, gated on the course being published. See
[features.md](features.md) › Course, and `TODOS.md` › Course sheet for the full investigation.

## `spec/ui-sample-*.png`

Style references only. They show the intended look; they are not layout specs and not a checklist.
