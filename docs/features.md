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
- **Inline list editing (list only):** the **first entity whose list cells edit in place**, and the
  reference for that pattern. Double-click opens a cell; the editor's blur saves it. PrimeNG's
  `pEditableColumn` opens on *single* click with no double-click option, so `CourseList` holds the
  edit state itself (`editing` signal + `(dblclick)`) rather than using `p-cellEditor`. Notes:
  - **Read-only columns** are `CourseList.READONLY_FIELDS` — `pkid` plus the two JOIN-resolved FK
    labels (`partnerName`, `courseGroupDescription`), which have no writable counterpart on the row.
    `publishStatus_pkid` *is* editable via dropdown, and its label is mirrored from the lookup on
    save.
  - **Saves re-fetch first.** The row carries only the n-n *counts*, and PUT delete-then-reinserts
    both link tables — so a request built from the row would wipe the course's certifications and
    job categories. `persist()` chains `getById` → `update` and overrides just the edited field.
  - **Validation mirrors `course-form`** (required, `min(0)`, max lengths) plus the cross-field rule
    `ScheduleOn ≤ ScheduleOff`, checked against the row's other endpoint. A failed validation keeps
    the cell open with an inline error; a failed *save* reverts the cell and toasts.
  - Date editors commit on `onSelect`, and on blur only once their overlay has closed — a blur while
    the panel is open would otherwise commit before the user picks.
- **QR code (detail only):** the 基本資料 card carries a QR code for the public course page
  `https://www.uuu.com.tw/Course/Show/{pkid}/{CourseId}` (`CourseId` percent-encoded), captioned with
  `CourseId` and downloadable as `{CourseId}.png`. Rendered by **`angularx-qrcode`** — pinned to
  **`^20`**, since v21 requires Angular 21; keep the majors aligned when upgrading Angular. It draws
  to a `<canvas>`, and `downloadQrCode()` reads that canvas via `toDataURL('image/png')`. Its
  transitive `qrcode` dep is CommonJS, hence `allowedCommonJsDependencies` in `angular.json`. This is
  the only entity with a QR code — it is **not** part of the standard detail scaffold.

Nav: 課程管理 Course › 課程 Course. Primary-Foreign links to CourseFAQ / CourseRelatedLink /
HotCourse are deferred until those features exist.

## FeaturedPromoItem (上稿作業) — [spec/custom/FeaturedPromoItem/FeaturedPromoItem.spec.md](../spec/custom/FeaturedPromoItem/FeaturedPromoItem.spec.md)

`int IDENTITY` PK. The **first customized CRUD**: the spec's mockups replace the standard
`p-table` + filter-drawer list with a weekly schedule grid, so this feature deviates from the list
conventions on purpose. Everything else (models, Dapper repo, routes, PUT-key-from-body) follows
`code-gen.convention.md`.

- **No list/detail/form triad.** `featured-promo-item-list` is the grid; `featured-promo-item-form`
  is an **inline child component** (inputs/outputs, not a routed page) that opens in the cell being
  edited. There is no detail page and no `/new` or `/:id/edit` route — the only route is
  `/featured-promo-items`.
- **Grid shape:** a TrainingCenter tab strip (`p-tabs`, fed by `GET /api/lookups/training-centers`)
  over a Monday–Sunday week, each day holding slots 1–3. Cells are rendered from the 7×3 product,
  not from the rows — an empty cell offers Edit / Paste, a filled one + / -- / Edit / Copy / Delete.
- **One-week filter:** `FeaturedPromoItemQuery.WeekStart` accepts *any* date; the **controller**
  snaps it to that week's Monday (`Week.MondayOf`) and the repo bounds `ScheduleOn` at
  `WeekStart + 6`. Normalizing in the controller (not the repo) keeps it under mocked-repo test.
  The client mirrors the same arithmetic in `mondayOf()` so the tab strip and header agree.
- **PromoCode → Promotion_pkid:** the form takes a *code*, not a pkid. `GET /api/lookups/promo-codes`
  feeds the autocomplete; `GET /api/lookups/promo-codes/{promoCode}` resolves one to
  `PromoCodeLookup` (404 when unknown, which blocks the save). Picking a code seeds Topic and
  Description but never overwrites text already typed — `FeaturedPromoItem.Topic`/`Description` are
  its **own columns**, independent of the promo's after creation.
- **Slot move (+ / --):** `POST /api/featured-promo-items/move` with `{pkid, delta}` (±1).
  `IX_FeaturedPromoItem_UniqueDateLocSlot` forbids two rows sharing a slot even mid-statement, so a
  swap parks the occupant on reserved slot `0` inside the transaction before landing it.
- **Copy / Paste** is client-only: Copy lifts `{promoCode, topic, description}` into a signal +
  `featured-promo-item-clipboard` session key; Paste opens a New form seeded with them.
- **Dates:** `ScheduleOn` is `date` → `DateOnly`, converted with **local** components
  (`toIso`/`parseDate` inline), never `toISOString()`.

Nav: 首頁管理 Home › 上稿作業 FeaturedPromoItem — adding this turned Home into an expandable nav
group. Promotion2 and TrainingCenter are FK targets that are **not built**, so the grid resolves
their labels via lookups and emits no Foreign-Primary links.
