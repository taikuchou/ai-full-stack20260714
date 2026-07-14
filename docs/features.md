# Implemented features — detail

Per-feature decisions and deviations. The index lives in [../CLAUDE.md](../CLAUDE.md); reusable
patterns live in [../spec/code-gen.convention.md](../spec/code-gen.convention.md). Where a feature
has a build spec under `spec/{area}/`, that spec is the fuller source — this file records what the
spec does not, plus the pattern each feature exemplifies.

## AppRole (角色) — no spec file

Full CRUD; the reference implementation for the **string PK** pattern (`RoleId`). N-N to `AppUser`
via `AppUserRole`. Nav: 系統管理 Admin › 角色 AppRole.

Because there is no `spec/` file for AppRole, the code itself is the source of truth for this
pattern — mirror `AppRoleController` / `AppRoleRepository` rather than any spec prose.

## AppUser (使用者) — [spec/auth/AppUser.md](../spec/auth/AppUser.md)

String PK `UserId` (same pattern as AppRole). N-N to `AppRole` via `AppUserRole` (`RoleIds`,
multiselect fed by `GET /api/lookups/approles`). `IsActive` bit → tri-state list filter; keyword
filters `UserId`/`UserName`. Nav: 系統管理 Admin › 使用者 AppUser.

**`PasswordHash` is backend-only** — absent from the response model, `AppUserRequest`, and every
Angular model:

- **Create:** SHA-256 (uppercase hex) of `SysConfig['appConfig'].defaultPassword`, with
  `PasswordUpdatedTime = GETUTCDATE()`.
- **Update:** never touches it.
- **Reset:** `POST /api/appusers/{id}/reset-password` re-applies the default (重設密碼 button on the
  detail page).

## PublishStatus (發布狀態) — [spec/admin/PublishStatus.md](../spec/admin/PublishStatus.md)

Exemplifies the **user-assigned `tinyint` PK** pattern (`byte`, not IDENTITY): editable in new,
disabled in edit, INSERT includes `pkid`, no `SCOPE_IDENTITY`. No FK, no N-N. Lookup
`GET /api/lookups/publish-statuses`. Nav: 系統管理 Admin › 發布狀態 PublishStatus.

FK target for Course (live) and Promotion2 (not built).

## Partner (合作廠商) — [spec/course/Partner.md](../spec/course/Partner.md)

Exemplifies the **`smallint IDENTITY` PK** pattern (`short`, DB-assigned): no pkid input in the
form, INSERT omits pkid and ends `SELECT CAST(SCOPE_IDENTITY() AS smallint)`, and
`PartnerRequest.Pkid` carries the UPDATE key. No FK, no N-N. Lookup `GET /api/lookups/partners`
(Label = `Name`, ordered by `DisplayOrder`). Nav: 課程管理 Course › 合作廠商 Partner — adding this
turned Course into an expandable nav group.

FK target for Course (live); Certification and PartnerCourseGroup are not built.

## CourseGroup (課程群組) — [spec/course/CourseGroup.md](../spec/course/CourseGroup.md)

Same `smallint IDENTITY` pattern as Partner. Single column `Description nvarchar(100)`; no FK, no
N-N. Route `/api/course-groups` — **kebab-case plural**, the first multi-word entity. Keyword filter
on `Description` only; default sort `pkid ASC`. Lookup `GET /api/lookups/course-groups`
(Label = `Description`, ordered by `pkid`). Nav: 課程管理 Course › 課程群組 CourseGroup.

FK target for Course (live); PartnerCourseGroup is not built.

## Course (課程) — [spec/course/Course.md](../spec/course/Course.md)

`int IDENTITY` PK. The **first FK-bearing entity** and the reference for both the FK and two-N-N
patterns.

- **FKs:** `Partner_pkid` (required), `CourseGroup_pkid` (**nullable** → 無 option, `LEFT JOIN`,
  `[showClear]`), `PublishStatus_pkid` (required). FK labels reach the list as **flat aliased
  read-only fields** (`PartnerName` / `CourseGroupDescription` / `PublishStatusDescription`) from
  `LEFT JOIN`s — **not** Dapper multi-map nav objects.
- **Two N-N:** `Certification` via `CourseInCertification` (`CertificationPkids: List<int>`) and
  `JobCategory` via `CourseJobCategories` (`JobCategoryPkids: List<short>`). Both delete+reinsert in
  one transaction; counts via correlated subquery; id lists filled on GET-by-id. New lookups
  `GET /api/lookups/certifications` (nchar → `RTRIM(Title)`) and `/job-categories`.
- **Dates:** `ScheduleOn`/`ScheduleOff` are `date` → `DateOnly`. The form converts with **local**
  date components (`toIso`/`parseDate` helpers inline — there is no `core/utils/`), never
  `toISOString()`.
- **Filters:** keyword (`Title`/`OfficialTitle`/`CourseId`/`ProdCourseId`/`FriendlyUrl` — long text
  excluded), 3 FK dropdowns, `CanRepeat` tri-state, `ScheduleOn` + `ScheduleOff` ranges. Default sort
  `DisplayOrder ASC, pkid ASC`.
- **Nav links:** the detail page emits the **first live Foreign-Primary links** (→ /partners,
  /course-groups, /publish-statuses).

Nav: 課程管理 Course › 課程 Course. Primary-Foreign links to CourseFAQ / CourseRelatedLink /
HotCourse are deferred until those features exist.
