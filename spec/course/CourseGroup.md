# Build Spec for CourseGroup
- database schema: `.\database\course.sql`

## Summary

`CourseGroup` is a small master table representing a course grouping / category (課程群組).
It carries only a single display description. It has no foreign keys of its own, and is
referenced as an FK target by `Course` (`Course.CourseGroup_pkid`, nullable) and
`PartnerCourseGroup` (`PartnerCourseGroup.CourseGroup_pkid`, NOT NULL).

**PK:** `pkid` is a `smallint IDENTITY` (→ C# `short`), **database-assigned** (identical pattern
to `Partner`). The user never enters it: the form has no pkid input (hidden on create,
display-only on edit), INSERT omits it, and `SELECT CAST(SCOPE_IDENTITY() AS smallint)` returns
the new value.

| Item | Detail |
|------|--------|
| Primary Key | `pkid` `smallint IDENTITY` → C# `short` (DB-assigned) |
| Foreign Keys | None |
| Required Fields | `Description` |
| N-N Relationships | N/A |
| Primary-Foreign Links | `Course`, `PartnerCourseGroup` FK to `CourseGroup.pkid` — **features not yet built; links deferred** |
| Query Filters | keyword (Description) |
| Default Sort | `pkid ASC` (no DisplayOrder column) |

---

## Localization

### Chinese Table Name

- CourseGroup: 課程群組
- Description: 課程群組 / 課程分類主檔

### Chinese Column Names

- pkid: 主代碼
- Description: 群組說明

---

## Required Fields

Required (NOT NULL, excluding IDENTITY PK):
- `Description` (string, max 100)

Optional (nullable):
- None.

---

## Foreign Keys

`CourseGroup` has no foreign key columns.

**N/A**

---

## Foreign-Primary Links

`CourseGroup` has no foreign key columns.

**N/A**

---

## Primary-Foreign Links

The following tables reference `CourseGroup.pkid` as a foreign key:

- **Course** (`Course.CourseGroup_pkid` → `CourseGroup.pkid`, nullable, `ON DELETE CASCADE`)
  - Column header: 對應課程
  - Button label: 查看課程 (icon: `pi pi-book`)
  - Intended link target: `/courses?courseGroupPkid={pkid}`
- **PartnerCourseGroup** (`PartnerCourseGroup.CourseGroup_pkid` → `CourseGroup.pkid`)
  - Column header: 對應廠商課程群組
  - Button label: 查看廠商課程群組 (icon: `pi pi-sitemap`)
  - Intended link target: `/partner-course-groups?courseGroupPkid={pkid}`

> **DEFERRED:** Neither Course nor PartnerCourseGroup features exist yet (only AppRole,
> PublishStatus, and Partner are built). These nav buttons would route to pages that do not
> exist. **The build will NOT emit these Primary-Foreign link buttons.** Add them when those
> child features are generated, wiring each child list's `courseGroupPkid` query param.

---

## N-N Relationships

No pure junction table references `CourseGroup`. `PartnerCourseGroup` links Partner and
CourseGroup but has its own IDENTITY `pkid` plus `DisplayOrder` and `Description` columns, so it
is modelled as a standalone child entity (a future Primary-Foreign link target), not an N-N
relationship.

**N/A**

---

## Query Filters

`POST /api/course-groups/query` accepts:

- **keyword**: string
  - LIKE on `Description` (the only string column).

No FK filters (no FK columns). No bool/date filters (no such columns). No DisplayOrder range
(no DisplayOrder column).

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/course-groups` | **New** | `LookupItem` list: `Id` = `pkid`, `Label` = `Description`, ordered by `pkid ASC` |

`CourseGroup` is an FK target for `Course` and `PartnerCourseGroup`, so a slim lookup endpoint is
added now for those future features to consume (matches the Partner precedent).

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/course-groups` | List all |
| `POST` | `/api/course-groups/query` | Filtered query (body: `CourseGroupQuery`) |
| `GET` | `/api/course-groups/{id}` | Get by pkid (`{id}` is a short) |
| `POST` | `/api/course-groups` | Create (pkid DB-assigned) |
| `PUT` | `/api/course-groups` | Update (pkid from body) |
| `DELETE` | `/api/course-groups/{id}` | Delete |
| `GET` | `/api/lookups/course-groups` | Slim lookup list (new) |

No auth exceptions. Standard CRUD only.

---

## Backend Notes

### Models

```csharp
// CourseGroup.cs — response model
public class CourseGroup
{
    public short Pkid { get; set; }                 // smallint IDENTITY, DB-assigned
    public string Description { get; set; } = string.Empty;
}

// CourseGroupRequest.cs — write DTO (Pkid carried for the UPDATE key; ignored on INSERT)
public class CourseGroupRequest
{
    public short Pkid { get; set; }
    [Required, MaxLength(100)] public string Description { get; set; } = string.Empty;
}

// CourseGroupQuery.cs — search DTO
public class CourseGroupQuery
{
    public string? Keyword { get; set; }
}
```

### SQL — SELECT (GetAll / Query / GetById)

No JOINs, no aliases, no `nchar`/`RTRIM` (`Description` is `nvarchar`):
```sql
SELECT pkid, Description
FROM CourseGroup
ORDER BY pkid ASC
```
Query appends keyword LIKE predicate. GetById filters `WHERE pkid = @Pkid`.

### SQL — INSERT

`pkid` is IDENTITY → **omit it**; return the new value:
```sql
INSERT INTO CourseGroup (Description)
VALUES (@Description);
SELECT CAST(SCOPE_IDENTITY() AS smallint);
```

### SQL — UPDATE

`pkid` is the key (WHERE clause), not in the SET list:
```sql
UPDATE CourseGroup
SET Description = @Description
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
| `/course-groups` | list |
| `/course-groups/new` | form (create) |
| `/course-groups/:id` | detail |
| `/course-groups/:id/edit` | form (edit) |

(Route order: `/new` before `/:id`.)

### Angular model

```typescript
export interface CourseGroup {
  pkid: number;
  description: string;
}

export interface CourseGroupRequest {
  pkid: number;
  description: string;
}

export interface CourseGroupQuery {
  keyword?: string | null;
}
```

### List component

- Columns: 主代碼 (pkid), 群組說明 (description).
- Filter drawer (`p-drawer`): keyword input only.
- Default sort `pkid ASC`.
- `confirmDelete` message: `` 確定要刪除主代碼 <b>${item.pkid}</b>「${item.description}」？``

### Detail component

- No Foreign-Primary link buttons (no FKs).
- No Primary-Foreign link buttons yet (Course / PartnerCourseGroup not built — deferred).

### Form component

- Reactive form. No lookups needed → no `forkJoin` required (all scalar fields).
- `pkid`: **not shown in the form** (IDENTITY, DB-assigned). Carried in the request (0 on create).
- `description`: `p-inputtext`, required, maxlength 100.

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `course-group-list-filters` | Last query filter values |
| `course-group-list-sort` | `{ sortField, sortOrder }` |
| `course-group-list-page` | `{ first, rows }` |

### Sidebar placement

Nav group **課程管理 Course** (already an expandable group after the Partner build). Add:
- Label: 課程群組 CourseGroup
- Route: `/course-groups`
- Icon: `pi pi-sitemap`

---

## Files to Create / Modify

### Backend (`CMS.API`)

| File | Action |
|------|--------|
| `Models/CourseGroup.cs` | create |
| `Models/CourseGroupRequest.cs` | create |
| `Models/CourseGroupQuery.cs` | create |
| `Repositories/ICourseGroupRepository.cs` | create |
| `Repositories/CourseGroupRepository.cs` | create |
| `Controllers/CourseGroupsController.cs` | create |
| `Repositories/ILookupRepository.cs` | modify — add `GetCourseGroupsAsync` |
| `Repositories/LookupRepository.cs` | modify — add `GetCourseGroupsAsync` |
| `Controllers/LookupsController.cs` | modify — add `course-groups` route |
| `Program.cs` | modify — register `ICourseGroupRepository` |

### Frontend (`CMS.NG`)

| File | Action |
|------|--------|
| `core/models/course-group.model.ts` | create |
| `core/services/course-group.service.ts` | create |
| `features/course-groups/course-group-list/` | create |
| `features/course-groups/course-group-detail/` | create |
| `features/course-groups/course-group-form/` | create |
| `app.routes.ts` | modify — add lazy routes |
| `app.ts` | modify — sidebar entry under 課程管理 Course |

### Tests

| File | Action |
|------|--------|
| `CMS.API.Tests/CourseGroupsControllerTests.cs` | create — list/query, get-by-id (found+404), create, update, delete, required-field 400 |
| `core/services/course-group.service.spec.ts` | create |
| `features/.../course-group-list.spec.ts` | create |
| `features/.../course-group-detail.spec.ts` | create |
| `features/.../course-group-form.spec.ts` | create |
