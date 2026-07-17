# TODOS

Deferred work, with the context needed to pick it up later.

## Course sheet / external document

- **ABANDONED — the Course sheet already exists in production. Build nothing.**
  `/office-hours` → `/autoplan` 2026-07-16 designed a `/courses/:id/sheet` route (Approach B, ~2
  days). **Assignment Check 0, run 2026-07-16, ended it:**

  **The public course page already has a 友善列印 ("Printer-Friendly") button.**
  `<input id="btnPrint" type="button" value="友善列印">`, click handler `function(){ print(); }`,
  backed by a purpose-built `https://www.uuu.com.tw/Public/css/DotDownload/css/printCourse.css`.
  It ships `@page { size: a4; margin: 1cm; orphans: 4; widows: 2 }`, hides every piece of
  marketing chrome (`header`, `#SocialMedia-BAR`, `#RelatedLink`, `#Seminars`, `#SiteMap`,
  `.tabs`, and `#btnPrint` itself), and kills Bootstrap's `a[href]::after { content: " (" attr(href) ")" }`
  so URLs do not print. It has been there since ~2017 (`/Public/css/2017V2/`, `?20180608`).
  **We own that site.** The design spent two days planning to rebuild it.

  Supporting facts, all verified:
  - `.../Course/Show/{Course.Pkid}/{CourseId}` — the page the course QR already points at —
    renders **the same CMS `Course` row**. Field-for-field for `Pkid=46`: `Hour=40` → 時數：40小時,
    `ListPrice=40000` → 費用：NT$ 40,000, `LearningCredit=11.0` → 點數：11.0, `OfficialTitle` verbatim.
  - It carries all four sections the sheet would print, and a *richer* schedule (real
    per-location class sessions vs. two bare `ScheduleOn`/`ScheduleOff` dates).
  - Published → 200. Discontinued (`35/PLF`) → `/Error/ResourceNotFound`.
    **436 published / 642 discontinued / 6 draft** of 1084.

  *The only question left is not engineering:* **why does the operator photocopy the admin
  screen when that button exists?** Most likely they don't know about it — show them. The one
  answer that would imply real work: they need documents for the **648 courses with no public
  page**. Note that is the exact *inverse* of the design's `isPublished` gate, which would have
  allowed the sheet only where 友善列印 already works and forbidden it for all 648.

  **DONE 2026-07-16 — discoverability fixed in code instead of training.** `course-detail` now
  has a 友善列印 button in `.page-actions` that opens the course's public page (where the real
  button lives) in a new tab. It reuses the existing `qrUrl()` computed — the same URL the QR
  already encodes — so there is one source of truth for the public URL.
  **This is a link, not a rebuilt sheet.** The CMS still renders no printable document, and
  should not; see the Check 0 evidence above before anyone reopens that.
  *The publish gate inverts here, and this is the interesting bit:* gating on
  `isPublished && !isDiscontinued` was **self-defeating for a sheet** (it allowed the sheet only
  where it was redundant) but is **exactly right for a link** (it stops the CMS pointing at a
  page that 404s — 648 of 1084 courses). Same predicate, opposite verdict, because the artifact
  changed. Implemented per the abandoned plan's decision #6: `PublishStatusService.getAll()`
  added to the existing `forkJoin`, resolved by pkid. Zero backend change.
  *Pre-existing and NOT fixed:* the QR code itself (`course-detail.html:53`, and the raw
  `<a class="qr-url">` beside it) still links to that same page **ungated**, so it points at a
  404 for those 648 courses. That was true before this change and premise 4 called it out. Left
  alone deliberately — out of scope for "add a button" — but it is a real inconsistency now that
  the button next to it *is* gated.

- **BUG in 友善列印: the printed schedule is truncated. Fix written and verified — needs applying
  in the uuu.com.tw repo (not this one).**
  Found 2026-07-16 by rendering course 46 (SSCP). `table#ClassList` has 9 `tbody` rows but only
  **4 render under print rules** — the rest carry bootstrap's `.hide` and sit behind the
  `點此展開更多課程時段` control, which print never reveals. `printCourse.css` also hides
  `div#ClassSection .tabs`. Net: the recipient gets **3 of 8 sessions with no sign the others
  exist** (page has 台北 ×5, 台中 ×1, 高雄 ×2; print shows three 台北 dates). Silent data loss on
  a document handed to partners/regulators.

  *The earlier caveat resolved the easy way:* the collapse is **a CSS class, not JS state**, so a
  stylesheet fix works. Two edits inside the existing `@media print` block:
  ```css
  /* 1. add #MoreList, #CloseList to the existing display:none hide-list */
  /* 2. new rule — !important is REQUIRED: bootstrap.css has .hide{display:none !important} */
  table#ClassList > tbody > tr.hide { display: table-row !important; }
  ```
  **Verified live against course 46:** 4/9 rows → **9/9**, sessions 3 → **8**, controls hidden,
  預約 column still correctly hidden, zebra striping and column widths unaffected.
  Full patch with diff, rationale and reproduction: `printCourse.css.patch.md` (handed to the
  user 2026-07-16; re-derivable from the numbers above).
  **This is the entire real work item from the 2026-07-16 course-PDF investigation** — everything
  else already works.
  *Two things unverifiable from outside:* whether high-session courses page-break cleanly, and
  whether `.hide` on `#ClassList` rows is *only* ever the collapse mechanism (if it also marks
  cancelled/sold-out sessions, this would print them). Confirm with the source before merging.

  Full evidence + reproduction commands:
  `~/.gstack/projects/taikuchou-ai-full-stack20260714/Admin-worktree-feature-course-pdf-design-20260716-102826.md`
  › *Check 0 Result*.

- **Generic multi-entity "external sheet" capability.**
  Deferred from `/autoplan` 2026-07-16 (CEO phase, SELECTIVE EXPANSION mode). Outside the
  blast radius of the current plan and needs new infra, so it is separate scope rather than
  an expansion of it.
  *The idea:* the Course sheet, if built, is a one-off. If a second entity ever needs an
  external-facing document, the honest options are copy-paste or a declared content contract
  per entity that a shared sheet component renders. Do not build this speculatively — build
  it the second time someone asks, not the first.
  *Blocked behind:* the Course sheet, which per Check 0 above should probably never be built.
  If the sheet dies, this dies with it.

- **`spec/course/Course.md` documents neither the QR code nor any print/PDF capability.**
  Noticed during `/office-hours` 2026-07-16. The QR is live in production
  (`course-detail.ts:8,26,37`) and `docs/features.md:252-258` documents it as an explicit
  deviation from the standard scaffold — but the entity's own spec is silent. If the sheet
  ships, it needs the same treatment. Independent of the sheet decision: the QR gap exists
  today.

- **`spec/sample1.spec.md` is a partially-implemented spec, not a template.**
  Noticed during `/autoplan` 2026-07-16. `CLAUDE.md:24` presents `sample1`/`sample2` as
  examples for authoring new specs, but `sample1`'s `### Detail — Inline QR Code` (`:401`)
  and `### List — Lookup Binding` (`:397`) both describe the **real, shipped** Course
  feature accurately, while `### Detail — 列印PDF` (`:405`) and
  `POST /api/courses/{id}/copy` (`:~402`) are not built. Anyone reading sample1 as fiction
  will mis-scope work (this is exactly what happened during the 2026-07-16 design session).
  Either mark the built entries as built, or move the real ones into
  `spec/course/Course.md` where they belong.

  **Update (Check 0, 2026-07-16): `:405` is a third category — built, but somewhere else.**
  `### Detail — 列印PDF` reads "`window.print()` via a toolbar button." That is a description
  of **友善列印**, live on the public course page (see the abandoned Course-sheet entry above).
  So sample1 has entries that are built *here* (`:397`, `:401`), built *on uuu.com.tw* (`:405`),
  and not built at all (`copy`) — all carrying the same dangling `See spec/course/Course.md`
  pointer. Reading `:405` as "not built" is what sent the design session after a two-day
  rebuild of a button that already exists. Whatever fix this entry gets, it must record **where**
  a thing is built, not just whether.

## Security

Deferred from the `/cso` full-project audit, 2026-07-17. Full report:
`.gstack/security-reports/2026-07-17-cso-full-project.json` (gitignored). No finding is an open,
exploitable door — the two real vulns from the 2026-07-16 review (privilege escalation, CourseGroup
cascade data-loss) are already fixed and tested. These are hardening / accepted-risk, ordered by
what is actually worth doing.

- **[security] Login has no rate-limit or lockout, over fast unsalted SHA-256 hashing.**
  `src/CMS.API/Controllers/AuthController.cs:26` (anonymous `POST /api/auth/login`, no throttle),
  `src/CMS.API/Security/PasswordHasher.cs:10` (`SHA256.HashData`, no salt, uppercase hex).
  The one residual item with real teeth: unthrottled online guessing, and a DB leak falls to
  rainbow tables instantly. It sits below the audit's exploitable-vuln gate ("missing rate limiting"
  is an explicit CSO hard-exclusion, and the hash scheme is documented accepted-risk for legacy
  compat), but it is the thing worth investing in first.
  *Fix:* add ASP.NET rate limiting + N-failure account lockout on the login action; migrate hashing
  to PBKDF2/bcrypt/Argon2 opportunistically on next password change, dual-reading legacy SHA-256
  hashes during transition so stored credentials keep working.

- **[security] Swagger UI is served unconditionally in every environment.**
  `src/CMS.API/Program.cs:114-119` — `UseSwagger()`/`UseSwaggerUI()` with no `IsDevelopment()` guard.
  Endpoints stay behind the global `AuthorizeFilter`, so this is attack-surface/schema disclosure,
  not data exposure, and the code marks it intentional for an internal tool. LOW; only matters if the
  app ever becomes internet-facing. *Fix:* gate behind `app.Environment.IsDevelopment()`, or require
  auth on the `/swagger` route.

- **[security] Non-constant-time password-hash comparison.**
  `src/CMS.API/Controllers/AuthController.cs:35` (and the change-password compare) use ordinary
  string `!=`. A network timing attack to recover a hex hash is impractical (jitter dwarfs the
  signal), so this is cosmetic. *Fix:* `CryptographicOperations.FixedTimeEquals` on the hash bytes.

- **[security] TLS to SQL Server is disabled in the connection string.**
  `src/CMS.API/appsettings.json:10` — `TrustServerCertificate=True;Encrypt=False`. Fine for a local
  `.\SQLEXPRESS` box; if the DB ever moves off-host, traffic (including password hashes on login) is
  cleartext on the wire. *Fix when deployed:* `Encrypt=True` with a valid server cert.

- **[security] Bearer token is attached to every outbound HttpClient request with no host allowlist.**
  `src/CMS.NG/src/app/core/interceptors/auth.interceptor.ts:9-10`. Not exploitable today — every one
  of the 10 services builds its URL from `environment.apiBaseUrl`, so nothing targets a third-party
  host. Latent: the first off-origin call added later would leak the JWT. *Fix:* guard the header on a
  same-origin / apiBaseUrl host check.

- **[security] Client `isAuthenticated` is presence-only, no token-expiry check.**
  `src/CMS.NG/src/app/core/services/auth.service.ts:26`. An expired-but-present JWT passes the client
  route guard until the first API call 401s and the interceptor logs out. Client-UX gap only; the
  server remains the real gate. *Fix:* have the guard inspect `exp` (the `jwt.util.ts` decoder already
  parses the token).

- **[security, note not a bug] Prior "stored XSS" in delete-confirm dialogs is a false positive for
  script execution.** PrimeNG's `ConfirmDialog` binds `message` via `[innerHTML]`, but Angular's
  default sanitizer strips `<script>`, `onerror`, and `javascript:` (no `bypassSecurityTrust` anywhere
  in app or PrimeNG). Residual is content-spoofing / phishing-link / external-image-load only, not
  token theft. Recorded so nobody re-files it as a high-severity XSS. Optional hardening: HTML-escape
  the interpolated free-text, keep the numeric `<b>${pkid}</b>`.

## Cross-cutting

- **`<p-toast />` sits at `app.html:3`, outside the `@if (isLoginPage())` split.**
  Deliberate — the comment says it is so a failed login request still surfaces. Flagged
  because any future chrome-less route (print view, embed, kiosk) inherits the toast whether
  it wants it or not, and `errorInterceptor` will render a server error onto that page. Not a
  bug today. Revisit when a second chrome-less route appears.
