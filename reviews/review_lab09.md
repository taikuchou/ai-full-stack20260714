# Whole-Project Review — CMS (`develop`)

- **Date:** 2026-07-16
- **Scope:** Entire project, first review. 76 API files, 88 Angular files, 17 test files across 7 CRUD features + auth + row-audit + global error handling.
- **Method:** Six specialist passes (security, SQL/data, API-contract, frontend, tests, maintainability).

**Verdict:** Architecturally clean and unusually well-documented. Cross-cutting machinery (auth, RowAudit transactions, global error handling) is correctly implemented, and every documented trap checked is actually handled right. Two access-control gaps and one data-loss footgun are the real problems; everything else is hardening or tidiness.

> **Update (see [../reviews](.) / TODOS.md › Security):** findings #1 and #2 were fixed in commit `93dc471` (Admin-gated mutations + `AuthorizationIntegrationTests.cs`; `FK_Course_CourseGroup` migrated to `ON DELETE SET NULL`). Finding #3 (stored XSS) was re-assessed on 2026-07-17 as a **false positive** for script execution — Angular sanitizes the PrimeNG `[innerHTML]` confirm message. The remaining hardening items are deferred in `TODOS.md` › Security.

---

## CRITICAL / HIGH — recommend fixing

### 1. Privilege escalation via user/role management — confidence 9/10

**Files:** `src/CMS.API/Controllers/AppUsersController.cs:53`, `src/CMS.API/Controllers/AppRolesController.cs:9`

Create/Update/Delete carry only the global "any authenticated user" filter, but Update writes `RoleIds` (→ `AppUserRepository.SyncRolesAsync`). Any non-admin can PUT `/api/appusers` with their own `UserId` and `RoleIds:["Admin"]`, then re-login for an Admin token (login re-reads roles from the DB). `reset-password` is correctly `[Authorize(Roles=Admin)]` — role assignment is a stronger primitive and was missed.

**Fix:** Add `[Authorize(Roles = AppRoles.Admin)]` to the mutating actions on both controllers; add a test asserting a non-admin gets 403.

### 2. Deleting a CourseGroup wipes all its courses, unaudited — confidence 8/10

**File:** `database/course.sql:343` (+ `src/CMS.API/Repositories/CourseGroupRepository.cs:123`)

`FK_Course_CourseGroup` on the nullable `CourseGroup_pkid` is `ON DELETE CASCADE`. `CourseGroupRepository.DeleteAsync` runs `DELETE FROM CourseGroup` with no guard, so the cascade silently removes every course in the group and bypasses RowAudit. Sibling required FKs (Partner, PublishStatus) correctly have no cascade — the asymmetry is the tell. The UI's 無 (none) option proves "no group" is a valid state → intended semantics are `ON DELETE SET NULL`.

**Fix:** Change the FK to `ON DELETE SET NULL` (needs a migration against the live DB), or have the repo block/repoint courses first.

---

## MEDIUM

### 3. Stored XSS in delete-confirm dialogs — confidence 8/10

**Files:** `course-list.ts:270`, `app-user-list.ts:152`, `app-user-detail.ts:75`, `app-user-form.ts:154`, `featured-promo-item-list.ts:277`

PrimeNG's ConfirmDialog renders `message` as innerHTML; the messages interpolate user-controlled `course.title` / `user.userId` / `promoCode`. A record named `<img src=x onerror=...>` runs script when another user goes to delete it.

**Fix:** HTML-escape the interpolated free-text (keep the numeric `<b>${pkid}</b>`).

> **2026-07-17 correction:** false positive for script execution. Angular's default sanitizer strips `<script>` / `on*` handlers / `javascript:` URLs on `[innerHTML]` bindings, and nothing calls `bypassSecurityTrust*`. Residual is content-injection (phishing link, external image load), not token theft. See `docs/features.md` › Security posture.

### 4. No rate-limiting or lockout on login — confidence 8/10

**File:** `src/CMS.API/Controllers/AuthController.cs:26`

Anonymous login with no throttle, over a fast unsalted SHA-256 hash, makes brute force cheap.

**Fix:** ASP.NET rate limiting + account lockout after N failures on `/api/auth/login`.

### 5. app-role-detail has zero test coverage — confidence 9/10

**File:** `src/CMS.NG/src/app/features/app-roles/app-role-detail/app-role-detail.ts`

The only detail component without a spec; its `forkJoin`, label-fallback, and error branch are untested.

**Fix:** Add `app-role-detail.spec.ts` mirroring the five sibling detail specs.

---

## LOW / INFORMATIONAL

6. **Course delete can fail on FK violation** (`CourseRepository.cs:238`, conf 6/10) — only clears `CourseInCertification`/`CourseJobCategories`; `CourseFAQ`/`HotCourse`/`CourseRelatedLink` FKs have no cascade, so a course with those rows (this DB has other consumers) throws → generic 500. Not data loss; consider a 409 guard.
7. **Non-constant-time hash compare** (`AuthController.cs:35`) — use `CryptographicOperations.FixedTimeEquals`.
8. **Client token-expiry unchecked** (`auth.service.ts:26`) — `isAuthenticated` is presence-only; expired tokens pass the guard until an API 401 bounces them.
9. **Bearer token attached to every HttpClient call** (`auth.interceptor.ts:10`) — no same-origin allowlist; latent leak (no third-party calls today).
10. **Missing** `row-audit.service.spec.ts`; no audit-rollback atomicity test.
11. **DRY / maintainability (frontend):** `toIso`/`parseDate` copy-pasted into 3 files with drifted null contracts (extract `date.util.ts`); list-state sessionStorage boilerplate duplicated ~60 lines × 6 components (extract a `ListStateStore`); `rows = 20` magic literal × 6 (a `DEFAULT_PAGE_SIZE` constant); Partner controller validation inline-duplicated while Courses/FeaturedPromoItems use a `Validate()` helper.

---

## CONFIRMED CLEAN (documented decisions, correctly implemented)

Dapper fully parameterized (no SQL injection); RowAudit writes share each operation's transaction with pre-update before-images; `FeaturedPromoItem.MoveAsync` slot-swap is atomic under its unique index; UTC datetime handling; JWT role-claim URI; error interceptor (no double-toast, deliberate 4xx pass through); API/TS contracts match field-for-field; `PasswordHash` never leaves the backend.

### NOT RE-FLAGGED (already accepted / documented)

- **SHA-256 password hashing** — legacy-compat; genuinely weak (unsalted/fast), but changing it breaks stored hashes. Flag for explicit risk-acceptance, not a quick fix.
- **JWT issuer/audience not validated** — deliberate, stateless-by-design.
- **QR code links to a public page that 404s** for ~648 unpublished courses — tracked in TODOS.md.

---

## FIX STATUS

No fixes were applied *at the time of this review*. When prioritizing, #1 (privilege escalation) is the one exploitable vuln — a ~15-minute fix. (Superseded: #1 and #2 fixed in `93dc471`; see the update note at the top.)
