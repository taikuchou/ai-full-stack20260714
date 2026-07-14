# Build Spec for PublishStatus
- database schema: `.\database\admin.sql`

## Summary

`PublishStatus` is a small master/lookup table describing the publishing lifecycle state
of content (draft / published / discontinued). It is referenced as a foreign key by
`Course` and `Promotion2`. It has no foreign keys of its own and no N-N relationships.

**Notable:** the primary key `pkid` is a **user-assigned `tinyint` (`byte`), NOT an IDENTITY
column.** The user supplies it on create. Treat it like the string-PK pattern (AppRole):
editable in the *new* form, disabled in the *edit* form, INSERT includes `pkid`, and there
is **no `SCOPE_IDENTITY()`**.

| Item | Detail |
|------|--------|
| Primary Key | `pkid` **tinyint, user-assigned (NOT IDENTITY)** → C# `byte` |
| Foreign Keys | None |
| Required Fields | `Description`, `IsDraft`, `IsPublished`, `IsDiscontinued` |
| N-N Relationships | N/A |
| Primary-Foreign Links | `Course` (`Course.PublishStatus_pkid`), `Promotion2` (`Promotion2.PublishStatus_pkid`) — **both features not yet built; links deferred** |
| Query Filters | keyword (Description); tri-state bools IsDraft, IsPublished, IsDiscontinued |
| Default Sort | `pkid ASC` |

---

## Localization

### Chinese Table Name

- PublishStatus: 發布狀態
- Description: 內容發布狀態主檔（草稿／已發布／已停用）

### Chinese Column Names

- pkid: 狀態代碼
- Description: 狀態說明
- IsDraft: 草稿
- IsPublished: 已發布
- IsDiscontinued: 已停用

---

## Required Fields

Required (NOT NULL):
- `pkid` (byte) — user-assigned PK; required in the *new* form, read-only in *edit*
- `Description` (string, max 50)
- `IsDraft` (bool)
- `IsPublished` (bool)
- `IsDiscontinued` (bool)

Optional (nullable):
- None — every column is NOT NULL.

---

## Foreign Keys

`PublishStatus` has no foreign key columns.

**N/A**

---

## Foreign-Primary Links

`PublishStatus` has no foreign key columns.

**N/A**

---

## Primary-Foreign Links

The following tables reference `PublishStatus.pkid` as a foreign key:

- **Course** (`Course.PublishStatus_pkid` → `PublishStatus.pkid`)
  - Column header: 對應課程
  - Button label: 查看課程 (icon: `pi pi-book`)
  - Intended link target: `/courses?publishStatusPkid={pkid}`
- **Promotion2** (`Promotion2.PublishStatus_pkid` → `PublishStatus.pkid`)
  - Column header: 對應優惠活動
  - Button label: 查看優惠活動 (icon: `pi pi-tag`)
  - Intended link target: `/promotions?publishStatusPkid={pkid}`

> **DEFERRED:** Neither the Course nor the Promotion2 feature is implemented yet (only AppRole
> and this PublishStatus feature exist). These nav buttons would route to pages that do not yet
> exist. **The build will NOT emit these Primary-Foreign link buttons.** Add them when the
> Course / Promotion2 features are generated, wiring the child list's `publishStatusPkid` query param.

---

## N-N Relationships

No junction tables reference `PublishStatus`.

**N/A**

---

## Query Filters

`POST /api/publish-statuses/query` accepts:

- **keyword**: string
  - LIKE on `Description`.

- **IsDraft**: bool? — tri-state (null = no filter, true = only drafts, false = non-drafts)
  - Exact match on `IsDraft`.

- **IsPublished**: bool? — tri-state
  - Exact match on `IsPublished`.

- **IsDiscontinued**: bool? — tri-state
  - Exact match on `IsDiscontinued`.

No FK filters (no FK columns). No date-range filters (no date columns).

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/publish-statuses` | **New** | `LookupItem` list: `Id` = `pkid`, `Label` = `Description`, ordered by `pkid ASC` |

`PublishStatus` is an FK target for `Course` and `Promotion2`, so a slim lookup endpoint is
added now for those future features to consume.

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/publish-statuses` | List all |
| `POST` | `/api/publish-statuses/query` | Filtered query (body: `PublishStatusQuery`) |
| `GET` | `/api/publish-statuses/{id}` | Get by pkid (`{id}` is a byte; no `:int` needed) |
| `POST` | `/api/publish-statuses` | Create (pkid supplied in body) |
| `PUT` | `/api/publish-statuses` | Update (pkid from body) |
| `DELETE` | `/api/publish-statuses/{id}` | Delete |
| `GET` | `/api/lookups/publish-statuses` | Slim lookup list (new) |

No auth exceptions. Standard CRUD only — no copy/swap actions.

---

## Backend Notes

### Models

```csharp
// PublishStatus.cs — response model
public class PublishStatus
{
    public byte Pkid { get; set; }            // user-assigned PK (tinyint, not IDENTITY)
    public string Description { get; set; } = string.Empty;
    public bool IsDraft { get; set; }
    public bool IsPublished { get; set; }
    public bool IsDiscontinued { get; set; }
}

// PublishStatusRequest.cs — write DTO (pkid included: user-assigned)
public class PublishStatusRequest
{
    public byte Pkid { get; set; }
    [Required, MaxLength(50)]
    public string Description { get; set; } = string.Empty;
    public bool IsDraft { get; set; }
    public bool IsPublished { get; set; }
    public bool IsDiscontinued { get; set; }
}

// PublishStatusQuery.cs — search DTO
public class PublishStatusQuery
{
    public string? Keyword { get; set; }
    public bool? IsDraft { get; set; }
    public bool? IsPublished { get; set; }
    public bool? IsDiscontinued { get; set; }
}
```

### SQL — SELECT (GetAll / Query / GetById)

No JOINs, no aliases, no `nchar`/`RTRIM` needed:
```sql
SELECT pkid, Description, IsDraft, IsPublished, IsDiscontinued
FROM PublishStatus
ORDER BY pkid ASC
```
Query appends predicates for keyword / IsDraft / IsPublished / IsDiscontinued when supplied.
GetById filters `WHERE pkid = @Pkid`.

### SQL — INSERT

`pkid` **is included** (user-assigned, not IDENTITY). No `SCOPE_IDENTITY()`:
```sql
INSERT INTO PublishStatus (pkid, Description, IsDraft, IsPublished, IsDiscontinued)
VALUES (@Pkid, @Description, @IsDraft, @IsPublished, @IsDiscontinued);
```

### SQL — UPDATE

`pkid` is the key (immutable), so it is in the WHERE clause, not the SET list:
```sql
UPDATE PublishStatus
SET Description = @Description, IsDraft = @IsDraft,
    IsPublished = @IsPublished, IsDiscontinued = @IsDiscontinued
WHERE pkid = @Pkid;
```

### N-N Sync Pattern

N/A.

### RowAudit

Inject `RowAuditWriter`. Log on INSERT / UPDATE / DELETE.
- Primary key value logged: `pkid`.
- INSERT: log the new `Description`.
- UPDATE: load existing entity, log changed property names via the AuditHelper pattern.
- DELETE: load existing entity, log its `Description`.

### Special Column Notes

- **`pkid` is `tinyint`, user-assigned (NOT IDENTITY)** — INSERT includes it, UPDATE keys on it.
  Mirror the AppRole string-PK controller/service pattern (value PK entered by user), but the
  C# type is `byte` and the route needs no `encodeURIComponent` (it's numeric).
- No `DateOnly`/`TimeOnly` columns. No `nchar` columns. No computed columns.

---

## Frontend Notes

### Route table

| Path | Component |
|------|-----------|
| `/publish-statuses` | list |
| `/publish-statuses/new` | form (create) |
| `/publish-statuses/:id` | detail |
| `/publish-statuses/:id/edit` | form (edit) |

(Route order: `/new` before `/:id`.)

### Angular model

```typescript
export interface PublishStatus {
  pkid: number;
  description: string;
  isDraft: boolean;
  isPublished: boolean;
  isDiscontinued: boolean;
}

export interface PublishStatusRequest {
  pkid: number;
  description: string;
  isDraft: boolean;
  isPublished: boolean;
  isDiscontinued: boolean;
}

export interface PublishStatusQuery {
  keyword?: string;
  isDraft?: boolean | null;
  isPublished?: boolean | null;
  isDiscontinued?: boolean | null;
}
```

### List component

- Columns: 狀態代碼 (pkid), 狀態說明 (description), 草稿 (isDraft), 已發布 (isPublished),
  已停用 (isDiscontinued) — booleans rendered as tick/tag chips.
- Filter drawer (`p-drawer`): keyword input; three tri-state selects (是／否／全部) for
  IsDraft, IsPublished, IsDiscontinued (`p-select`, `appendTo="body"`).
- Default sort `pkid ASC`.
- `confirmDelete` message: `` 確定要刪除狀態代碼 <b>${item.pkid}</b>「${item.description}」？``

### Detail component

- `RowAuditBadgeComponent` in toolbar `#start`.
- No Foreign-Primary link buttons (no FKs).
- No Primary-Foreign link buttons yet (Course / Promotion2 features not built — see deferred note above).

### Form component

- Reactive form. No lookups needed → no `forkJoin` required (booleans + text only).
- `pkid`: `p-inputnumber` (min 0, max 255), **editable in new, `disable()`d in edit** (value-PK pattern).
- `description`: `p-inputtext`, required, maxlength 50.
- `isDraft` / `isPublished` / `isDiscontinued`: `p-toggleswitch` (or `p-checkbox`).
- Sticky `p-toolbar`; `RowAuditBadgeComponent` in toolbar `#start`.

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `publish-status-list-filters` | Last query filter values |
| `publish-status-list-sort` | `{ sortField, sortOrder }` |
| `publish-status-list-page` | `{ first, rows }` |

### Date Handling

N/A — no date/datetime columns.

### Sub-panels

N/A.

### Sidebar placement

Nav group **系統管理 Admin** (existing — created by AppRole). Add entry:
- Label: 發布狀態 PublishStatus
- Route: `/publish-statuses`

---

## Files to Create / Modify

### Backend (`CMS.API`)

| File | Action |
|------|--------|
| `Models/PublishStatus.cs` | create |
| `Models/PublishStatusRequest.cs` | create |
| `Models/PublishStatusQuery.cs` | create |
| `Repositories/IPublishStatusRepository.cs` | create |
| `Repositories/PublishStatusRepository.cs` | create |
| `Controllers/PublishStatusesController.cs` | create |
| `Repositories/ILookupRepository.cs` | modify — add `GetPublishStatusesAsync` |
| `Repositories/LookupRepository.cs` | modify — add `GetPublishStatusesAsync` |
| `Controllers/LookupsController.cs` | modify — add `publish-statuses` route |
| `Program.cs` | modify — register `IPublishStatusRepository` |

### Frontend (`CMS.NG`)

| File | Action |
|------|--------|
| `core/models/publish-status.model.ts` | create |
| `core/services/publish-status.service.ts` | create |
| `features/publish-statuses/publish-status-list/` | create |
| `features/publish-statuses/publish-status-detail/` | create |
| `features/publish-statuses/publish-status-form/` | create |
| `core/services/lookup.service.ts` | modify — add `getPublishStatuses` (if file exists) |
| `app.routes.ts` | modify — add lazy routes |
| `app.html` / `app.ts` | modify — sidebar entry under 系統管理 Admin |

### Tests

| File | Action |
|------|--------|
| `CMS.API.Tests/PublishStatusesControllerTests.cs` | create — list/query, get-by-id (found+404), create, update, delete, required-field 400 |
| `core/services/publish-status.service.spec.ts` | create — asserts URL/verb per method |
| `features/.../publish-status-list.spec.ts` | create |
| `features/.../publish-status-detail.spec.ts` | create |
| `features/.../publish-status-form.spec.ts` | create — required-field enforcement |
