# Build Spec for Partner
- database schema: `.\database\course.sql`

## Summary

`Partner` is a master table representing a training-course partner / provider (合作廠商).
It carries display names used in different UI surfaces (partner menu, course detail page),
a sort order, an app key, and an optional logo image filename. It has no foreign keys of its
own, and is referenced as an FK target by `Course`, `Certification`, and `PartnerCourseGroup`.

**PK:** `pkid` is a `smallint IDENTITY` (→ C# `short`), **database-assigned**. Unlike AppRole
(string PK) or PublishStatus (user-assigned tinyint), the user never enters it: the form has no
pkid input (hidden on create, display-only on edit), INSERT omits it, and `SCOPE_IDENTITY()`
returns the new value. Mirror the Course sample's IDENTITY-PK pattern.

| Item | Detail |
|------|--------|
| Primary Key | `pkid` `smallint IDENTITY` → C# `short` (DB-assigned) |
| Foreign Keys | None |
| Required Fields | `Name`, `AppKey`, `NameOnPartnerMenu`, `NameOnCourseDetailPage`, `DisplayOrder` |
| N-N Relationships | N/A (`PartnerCourseGroup` is a child entity with its own PK + extra columns, not a pure junction) |
| Primary-Foreign Links | `Certification`, `Course`, `PartnerCourseGroup` all FK to `Partner.pkid` — **features not yet built; links deferred** |
| Query Filters | keyword (Name, AppKey, NameOnPartnerMenu, NameOnCourseDetailPage); DisplayOrder range |
| Default Sort | `DisplayOrder ASC` |

---

## Localization

### Chinese Table Name

- Partner: 合作廠商
- Description: 課程合作廠商 / 提供者主檔

### Chinese Column Names

- pkid: 主代碼
- Name: 廠商名稱
- AppKey: 應用代碼
- NameOnPartnerMenu: 選單顯示名稱
- NameOnCourseDetailPage: 課程頁顯示名稱
- DisplayOrder: 顯示順序
- ImageFilename: 圖檔名稱

---

## Required Fields

Required (NOT NULL, excluding IDENTITY PK):
- `Name` (string, max 50)
- `AppKey` (string, max 10)
- `NameOnPartnerMenu` (string, max 200)
- `NameOnCourseDetailPage` (string, max 50)
- `DisplayOrder` (int)

Optional (nullable):
- `ImageFilename` (string, max 50)

---

## Foreign Keys

`Partner` has no foreign key columns.

**N/A**

---

## Foreign-Primary Links

`Partner` has no foreign key columns.

**N/A**

---

## Primary-Foreign Links

The following tables reference `Partner.pkid` as a foreign key:

- **Course** (`Course.Partner_pkid` → `Partner.pkid`)
  - Column header: 對應課程
  - Button label: 查看課程 (icon: `pi pi-book`)
  - Intended link target: `/courses?partnerPkid={pkid}`
- **Certification** (`Certification.Partner_pkid` → `Partner.pkid`)
  - Column header: 對應認證
  - Button label: 查看認證 (icon: `pi pi-verified`)
  - Intended link target: `/certifications?partnerPkid={pkid}`
- **PartnerCourseGroup** (`PartnerCourseGroup.Partner_pkid` → `Partner.pkid`)
  - Column header: 對應課程群組
  - Button label: 查看課程群組 (icon: `pi pi-sitemap`)
  - Intended link target: `/partner-course-groups?partnerPkid={pkid}`

> **DEFERRED:** None of Course / Certification / PartnerCourseGroup features exist yet (only
> AppRole and PublishStatus are built). These nav buttons would route to pages that do not
> exist. **The build will NOT emit these Primary-Foreign link buttons.** Add them when those
> child features are generated, wiring each child list's `partnerPkid` query param.

---

## N-N Relationships

No pure junction table references `Partner`. `PartnerCourseGroup` links Partner and CourseGroup
but has its own IDENTITY `pkid` plus `DisplayOrder` and `Description` columns, so it is modelled
as a standalone child entity (a future Primary-Foreign link target), not an N-N relationship.

**N/A**

---

## Query Filters

`POST /api/partners/query` accepts:

- **keyword**: string
  - LIKE on `Name`, `AppKey`, `NameOnPartnerMenu`, `NameOnCourseDetailPage`.
  - `ImageFilename` excluded (not an identifying field).

- **DisplayOrder**: int range
  - `DisplayOrder` BETWEEN `displayOrderFrom` (inclusive) and `displayOrderTo` (inclusive).

No FK filters (no FK columns). No bool/date filters (no such columns).

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/partners` | **New** | `LookupItem` list: `Id` = `pkid`, `Label` = `Name`, ordered by `DisplayOrder ASC` |

`Partner` is an FK target for `Course` and `Certification`, so a slim lookup endpoint is added
now for those future features to consume (matches the Course sample's `GET /api/lookups/partners`).

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/partners` | List all |
| `POST` | `/api/partners/query` | Filtered query (body: `PartnerQuery`) |
| `GET` | `/api/partners/{id}` | Get by pkid (`{id}` is a short) |
| `POST` | `/api/partners` | Create (pkid DB-assigned) |
| `PUT` | `/api/partners` | Update (pkid from body) |
| `DELETE` | `/api/partners/{id}` | Delete |
| `GET` | `/api/lookups/partners` | Slim lookup list (new) |

No auth exceptions. Standard CRUD only.

---

## Backend Notes

### Models

```csharp
// Partner.cs — response model
public class Partner
{
    public short Pkid { get; set; }                 // smallint IDENTITY, DB-assigned
    public string Name { get; set; } = string.Empty;
    public string AppKey { get; set; } = string.Empty;
    public string NameOnPartnerMenu { get; set; } = string.Empty;
    public string NameOnCourseDetailPage { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public string? ImageFilename { get; set; }
}

// PartnerRequest.cs — write DTO (Pkid carried for the UPDATE key; ignored on INSERT)
public class PartnerRequest
{
    public short Pkid { get; set; }
    [Required, MaxLength(50)]  public string Name { get; set; } = string.Empty;
    [Required, MaxLength(10)]  public string AppKey { get; set; } = string.Empty;
    [Required, MaxLength(200)] public string NameOnPartnerMenu { get; set; } = string.Empty;
    [Required, MaxLength(50)]  public string NameOnCourseDetailPage { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    [MaxLength(50)] public string? ImageFilename { get; set; }
}

// PartnerQuery.cs — search DTO
public class PartnerQuery
{
    public string? Keyword { get; set; }
    public int? DisplayOrderFrom { get; set; }
    public int? DisplayOrderTo { get; set; }
}
```

### SQL — SELECT (GetAll / Query / GetById)

No JOINs, no aliases, no `nchar`/`RTRIM` (all columns are `nvarchar`/`varchar`):
```sql
SELECT pkid, Name, AppKey, NameOnPartnerMenu, NameOnCourseDetailPage, DisplayOrder, ImageFilename
FROM Partner
ORDER BY DisplayOrder ASC
```
Query appends keyword LIKE + DisplayOrder range predicates. GetById filters `WHERE pkid = @Pkid`.

### SQL — INSERT

`pkid` is IDENTITY → **omit it**; return the new value:
```sql
INSERT INTO Partner (Name, AppKey, NameOnPartnerMenu, NameOnCourseDetailPage, DisplayOrder, ImageFilename)
VALUES (@Name, @AppKey, @NameOnPartnerMenu, @NameOnCourseDetailPage, @DisplayOrder, @ImageFilename);
SELECT CAST(SCOPE_IDENTITY() AS smallint);
```

### SQL — UPDATE

`pkid` is the key (WHERE clause), not in the SET list:
```sql
UPDATE Partner
SET Name = @Name, AppKey = @AppKey, NameOnPartnerMenu = @NameOnPartnerMenu,
    NameOnCourseDetailPage = @NameOnCourseDetailPage, DisplayOrder = @DisplayOrder,
    ImageFilename = @ImageFilename
WHERE pkid = @Pkid;
```

### N-N Sync Pattern

N/A.

### Special Column Notes

- **`pkid` is `smallint IDENTITY`** → C# `short`. Omit from INSERT; return via `SELECT CAST(SCOPE_IDENTITY() AS smallint)`.
- No `DateOnly`/`TimeOnly`, no `nchar`, no computed columns.

---

## Frontend Notes

### Route table

| Path | Component |
|------|-----------|
| `/partners` | list |
| `/partners/new` | form (create) |
| `/partners/:id` | detail |
| `/partners/:id/edit` | form (edit) |

(Route order: `/new` before `/:id`.)

### Angular model

```typescript
export interface Partner {
  pkid: number;
  name: string;
  appKey: string;
  nameOnPartnerMenu: string;
  nameOnCourseDetailPage: string;
  displayOrder: number;
  imageFilename: string | null;
}

export interface PartnerRequest {
  pkid: number;
  name: string;
  appKey: string;
  nameOnPartnerMenu: string;
  nameOnCourseDetailPage: string;
  displayOrder: number;
  imageFilename: string | null;
}

export interface PartnerQuery {
  keyword?: string | null;
  displayOrderFrom?: number | null;
  displayOrderTo?: number | null;
}
```

### List component

- Columns: 主代碼 (pkid), 廠商名稱 (name), 應用代碼 (appKey), 選單顯示名稱 (nameOnPartnerMenu),
  課程頁顯示名稱 (nameOnCourseDetailPage), 顯示順序 (displayOrder).
- Filter drawer (`p-drawer`): keyword input; DisplayOrder range (two `p-inputNumber`).
- Default sort `DisplayOrder ASC`.
- `confirmDelete` message: `` 確定要刪除主代碼 <b>${item.pkid}</b>「${item.name}」？``

### Detail component

- No Foreign-Primary link buttons (no FKs).
- No Primary-Foreign link buttons yet (Course / Certification / PartnerCourseGroup not built — deferred).

### Form component

- Reactive form. No lookups needed → no `forkJoin` required (all scalar fields).
- `pkid`: **not shown in the form** (IDENTITY, DB-assigned). Carried in the request (0 on create).
- `name`: `p-inputtext`, required, maxlength 50.
- `appKey`: `p-inputtext`, required, maxlength 10.
- `nameOnPartnerMenu`: `p-inputtext`, required, maxlength 200.
- `nameOnCourseDetailPage`: `p-inputtext`, required, maxlength 50.
- `displayOrder`: `p-inputNumber`, required, min 0.
- `imageFilename`: `p-inputtext`, optional, maxlength 50.

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `partner-list-filters` | Last query filter values |
| `partner-list-sort` | `{ sortField, sortOrder }` |
| `partner-list-page` | `{ first, rows }` |

### Sidebar placement

Nav group **課程管理 Course**. In `app.ts` this is currently a top-level menu item with no
`route`/`children` (a placeholder). Convert it to an expandable group (like 系統管理 Admin) and
add:
- Label: 合作廠商 Partner
- Route: `/partners`
- Icon: `pi pi-building`

---

## Files to Create / Modify

### Backend (`CMS.API`)

| File | Action |
|------|--------|
| `Models/Partner.cs` | create |
| `Models/PartnerRequest.cs` | create |
| `Models/PartnerQuery.cs` | create |
| `Repositories/IPartnerRepository.cs` | create |
| `Repositories/PartnerRepository.cs` | create |
| `Controllers/PartnersController.cs` | create |
| `Repositories/ILookupRepository.cs` | modify — add `GetPartnersAsync` |
| `Repositories/LookupRepository.cs` | modify — add `GetPartnersAsync` |
| `Controllers/LookupsController.cs` | modify — add `partners` route |
| `Program.cs` | modify — register `IPartnerRepository` |

### Frontend (`CMS.NG`)

| File | Action |
|------|--------|
| `core/models/partner.model.ts` | create |
| `core/services/partner.service.ts` | create |
| `features/partners/partner-list/` | create |
| `features/partners/partner-detail/` | create |
| `features/partners/partner-form/` | create |
| `app.routes.ts` | modify — add lazy routes |
| `app.ts` | modify — sidebar entry under 課程管理 Course (convert to expandable group) |

### Tests

| File | Action |
|------|--------|
| `CMS.API.Tests/PartnersControllerTests.cs` | create — list/query, get-by-id (found+404), create, update, delete, required-field 400 |
| `core/services/partner.service.spec.ts` | create |
| `features/.../partner-list.spec.ts` | create |
| `features/.../partner-detail.spec.ts` | create |
| `features/.../partner-form.spec.ts` | create |
