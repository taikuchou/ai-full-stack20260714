# Build Spec for Course

- database schema: `.\database\course.sql`

## Summary

`Course` (課程) is the central course master table. It carries identifying codes
(`CourseId`, `ProdCourseId`), display titles, a partner/group/publish-status classification,
a scheduling window (`ScheduleOn`/`ScheduleOff`), pricing and credit figures, and a large set
of long-text description columns. It has three foreign keys and participates in two pure
many-to-many relationships.

**PK:** `pkid` is an `int IDENTITY` (→ C# `int`), **database-assigned** (same DB-assigned
pattern as `Partner`/`CourseGroup`, just `int` instead of `smallint`): the form has no `pkid`
input (hidden on create, display-only on edit), INSERT omits it, and
`SELECT CAST(SCOPE_IDENTITY() AS int)` returns the new value. `PartnerRequest.Pkid`-style key
carried in `CourseRequest.Pkid` for the UPDATE.

> **First FK-bearing entity.** All previously built features (AppRole, AppUser, PublishStatus,
> Partner, CourseGroup) have no foreign keys. Course is the first list that must display FK
> label columns. This spec uses **flat, read-only aliased label fields** on the response model
> (`PartnerName`, `CourseGroupDescription`, `PublishStatusDescription`) populated by `LEFT JOIN`s
> — simpler than Dapper multi-map nav objects and a direct fit for the requested list columns.

| Item | Detail |
|------|--------|
| Primary Key | `pkid` `int IDENTITY` → C# `int` (DB-assigned) |
| Foreign Keys | `Partner_pkid`→`Partner` (NOT NULL); `CourseGroup_pkid`→`CourseGroup` (**nullable**); `PublishStatus_pkid`→`PublishStatus` (NOT NULL) |
| Required Fields | `Title`, `CourseId`, `ProdCourseId`, `FriendlyUrl`, `DisplayOrder`, `Partner_pkid`, `PublishStatus_pkid`, `ScheduleOn`, `ScheduleOff`, `Hour`, `ListPrice`, `LearningCredit`, `CanRepeat` |
| N-N Relationships | `CourseInCertification` → `Certification` (`CertificationPkids`); `CourseJobCategories` → `JobCategory` (`JobCategoryPkids`) |
| Primary-Foreign Links | `CourseFAQ`, `CourseRelatedLink`, `HotCourse` FK to `Course.pkid` — **features not built; links deferred** |
| Query Filters | keyword (Title, OfficialTitle, CourseId, ProdCourseId, FriendlyUrl); Partner / CourseGroup / PublishStatus FK dropdowns; CanRepeat tri-state; ScheduleOn range; ScheduleOff range |
| Default Sort | `DisplayOrder ASC, pkid ASC` |

---

## Localization

### Chinese Table Name

- Course: 課程
- Description: 課程主檔（含代碼、標題、廠商／群組／狀態分類、上下架排程、價格點數與說明欄位）

### Chinese Column Names

- pkid: 主代碼
- Title: 課程名稱
- OfficialTitle: 正式名稱
- CourseId: 簡介代碼
- ProdCourseId: 科目代碼
- FriendlyUrl: 網址代稱
- DisplayOrder: 顯示順序
- Partner_pkid: 原廠
- CourseGroup_pkid: 課程群組
- PublishStatus_pkid: 上架狀態
- ScheduleOn: 上架日期
- ScheduleOff: 下架日期
- Hour: 時數
- ListPrice: 定價
- LearningCredit: 點數
- Material: 教材
- Objective: 課程目標
- Target: 適合對象
- Prerequisites: 先修條件
- Outline: 課程大綱
- TowardCertOrExam: 對應認證／考試
- Note: 備註
- OtherInfo: 其他資訊
- CanRepeat: 允許重聽
- (N-N) Certifications: 對應認證
- (N-N) JobCategories: 職務類別

---

## Required Fields

Required (NOT NULL, excluding IDENTITY PK):
- `Title` (string, max 200)
- `CourseId` (string, max 50)
- `ProdCourseId` (string, max 50)
- `FriendlyUrl` (string, max 100)
- `DisplayOrder` (int)
- `Partner_pkid` (short)
- `PublishStatus_pkid` (byte)
- `ScheduleOn` (DateOnly)
- `ScheduleOff` (DateOnly)
- `Hour` (short, DB default 0)
- `ListPrice` (decimal(9,0), DB default 0)
- `LearningCredit` (decimal(9,1), DB default 0)
- `CanRepeat` (bool, DB default 0)

Optional (nullable):
- `OfficialTitle` (string, max 300)
- `CourseGroup_pkid` (short?) — nullable FK
- `Material` (string, max 500)
- `Objective` (string, max 4000)
- `Target` (string, max 500)
- `Prerequisites` (string, max 4000)
- `Outline` (string, max — `nvarchar(max)`)
- `TowardCertOrExam` (string, max — `nvarchar(max)`)
- `Note` (string, max 4000)
- `OtherInfo` (string, max 4000)

---

## Foreign Keys

- **`Partner_pkid`** (`smallint`, NOT NULL) → `Partner.pkid`.
  - Label: `Partner.Name`. Order by `Partner.DisplayOrder ASC`.
  - Lookup: `GET /api/lookups/partners` (**exists**).
- **`CourseGroup_pkid`** (`smallint`, **NULL**) → `CourseGroup.pkid`.
  - Label: `CourseGroup.Description`. Order by `CourseGroup.pkid ASC`.
  - Nullable → dropdown offers a "無" (none) option; `LEFT JOIN` in SELECTs.
  - Lookup: `GET /api/lookups/course-groups` (**exists**).
- **`PublishStatus_pkid`** (`tinyint`, NOT NULL) → `PublishStatus.pkid`.
  - Label: `PublishStatus.Description`. Order by `PublishStatus.pkid ASC`.
  - Lookup: `GET /api/lookups/publish-statuses` (**exists**).

All three lookup endpoints already exist and return `LookupItem { Id: string, Label: string }`.
FK values arrive from the client as strings (LookupItem.Id) and are parsed to `short`/`byte`.

---

## Foreign-Primary Links

Outbound navigation from Course to each referenced primary detail page:

- `Partner_pkid` → `/partners/{Partner_pkid}` (Partner detail) — **Partner feature is built**, link is live.
- `CourseGroup_pkid` → `/course-groups/{CourseGroup_pkid}` (CourseGroup detail) — **built**, link is live (only when not null).
- `PublishStatus_pkid` → `/publish-statuses/{PublishStatus_pkid}` (PublishStatus detail) — **built**, link is live.

> These three targets exist, so the Course **detail** page renders their nav links. (This is the
> first entity able to emit live Foreign-Primary links.)

---

## Primary-Foreign Links

Tables referencing `Course.pkid` as an FK (child entities, not junctions):

- **CourseFAQ** (`CourseFAQ.Course_pkid`) — 對應常見問題, target `/course-faqs?coursePkid={pkid}`
- **CourseRelatedLink** (`CourseRelatedLink.Course_pkid`) — 對應相關連結, target `/course-related-links?coursePkid={pkid}`
- **HotCourse** (`HotCourse.Course_pkid`) — 對應熱門課程, target `/hot-courses?coursePkid={pkid}`

> **DEFERRED:** None of CourseFAQ / CourseRelatedLink / HotCourse features exist yet. **The build
> will NOT emit these Primary-Foreign link buttons.** Add them when those child features are
> generated, wiring each child list's `coursePkid` query param.

(The two remaining tables that reference `Course.pkid` — `CourseInCertification` and
`CourseJobCategories` — are pure junctions and handled as N-N below, not as Primary-Foreign links.)

---

## N-N Relationships

Two pure junction tables have exactly two FK columns, one being `Course_pkid`:

### 1. Certification — via `CourseInCertification`
- Junction columns: `Course_pkid` (int) + `Certification_pkid` (int).
- Related entity **B**: `Certification` (pkid int IDENTITY, `Title nchar(100) NULL`).
- Lookup endpoint: `GET /api/lookups/certifications` (**New**). Label = `RTRIM(Title)` (nchar → RTRIM), order by `pkid ASC`.
- **List view**: not shown as a column (per requested list layout).
- **Detail view**: show associated certification labels (chips / comma list).
- **Form (edit + new)**: `p-multiselect` (認證).
- Request field: `CertificationPkids: List<int>`.
- Model read fields: `CertificationPkids: List<int>` (filled on GET-by-id) + `CertificationCount` (correlated subquery for list/query).

### 2. JobCategory — via `CourseJobCategories`
- Junction columns: `Course_pkid` (int) + `JobCategory_pkid` (smallint).
- Related entity **B**: `JobCategory` (pkid smallint IDENTITY, `Description nvarchar(70) NOT NULL`).
- Lookup endpoint: `GET /api/lookups/job-categories` (**New**). Label = `Description`, order by `Description ASC`.
- **Detail view**: show associated job-category labels.
- **Form (edit + new)**: `p-multiselect` (職務類別).
- Request field: `JobCategoryPkids: List<short>`.
- Model read fields: `JobCategoryPkids: List<short>` (filled on GET-by-id) + `JobCategoryCount` (correlated subquery for list/query).

**Sync pattern (both, inside the write transaction):**
```sql
DELETE FROM CourseInCertification WHERE Course_pkid = @Pkid;
-- re-insert each id in CertificationPkids
DELETE FROM CourseJobCategories  WHERE Course_pkid = @Pkid;
-- re-insert each id in JobCategoryPkids
```
Mirror the existing AppRole↔AppUser (`AppUserRole`) delete-then-reinsert junction pattern.

---

## Query Filters

`POST /api/courses/query` accepts:

- **keyword**: string — LIKE on `Title`, `OfficialTitle`, `CourseId`, `ProdCourseId`, `FriendlyUrl`.
  Long-text columns (`Objective`, `Prerequisites`, `Outline`, `TowardCertOrExam`, `Note`,
  `OtherInfo`, `Material`, `Target`) are **excluded** (slow, rarely useful).
- **PartnerPkid** (`short?`): exact match on `Partner_pkid`. Dropdown from `GET /api/lookups/partners`.
- **CourseGroupPkid** (`short?`): exact match on `CourseGroup_pkid`. Dropdown from `GET /api/lookups/course-groups`.
- **PublishStatusPkid** (`byte?`): exact match on `PublishStatus_pkid`. Dropdown from `GET /api/lookups/publish-statuses`.
- **CanRepeat** (`bool?`): tri-state — null = no filter, true = checked, false = unchecked.
- **ScheduleOn range** (`ScheduleOnFrom`, `ScheduleOnTo`, `DateOnly?`): `ScheduleOn BETWEEN` (inclusive).
- **ScheduleOff range** (`ScheduleOffFrom`, `ScheduleOffTo`, `DateOnly?`): `ScheduleOff BETWEEN` (inclusive).

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/partners` | Exists | `Id`=pkid (as text), `Label`=`Name`, order `DisplayOrder ASC` |
| `GET /api/lookups/course-groups` | Exists | `Id`=pkid (as text), `Label`=`Description`, order `pkid ASC` |
| `GET /api/lookups/publish-statuses` | Exists | `Id`=pkid (as text), `Label`=`Description`, order `pkid ASC` |
| `GET /api/lookups/certifications` | **New** | `Id`=pkid (as text), `Label`=`RTRIM(Title)`, order `pkid ASC` |
| `GET /api/lookups/job-categories` | **New** | `Id`=pkid (as text), `Label`=`Description`, order `Description ASC` |

Course is not (currently) an FK target for any built feature, so no `GET /api/lookups/courses`
is added yet (the three deferred child features would consume it when built).

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/courses` | List all (with FK label JOINs + N-N counts) |
| `POST` | `/api/courses/query` | Filtered query (body: `CourseQuery`) |
| `GET` | `/api/courses/{id}` | Get by pkid (`{id}` is an int); fills `CertificationPkids` + `JobCategoryPkids` |
| `POST` | `/api/courses` | Create (pkid DB-assigned; N-N inserted in txn) |
| `PUT` | `/api/courses` | Update (pkid from body; N-N delete+reinsert in txn) |
| `DELETE` | `/api/courses/{id}` | Delete (junction rows cascade via FK `ON DELETE CASCADE`) |
| `GET` | `/api/lookups/certifications` | Slim lookup (new) |
| `GET` | `/api/lookups/job-categories` | Slim lookup (new) |

No auth exceptions. Standard CRUD only.

---

## Backend Notes

### Models

```csharp
// Course.cs — response model
public class Course
{
    public int Pkid { get; set; }                       // int IDENTITY, DB-assigned
    public string Title { get; set; } = string.Empty;
    public string? OfficialTitle { get; set; }
    public string CourseId { get; set; } = string.Empty;
    public string ProdCourseId { get; set; } = string.Empty;
    public string FriendlyUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }

    public short Partner_pkid { get; set; }
    public short? CourseGroup_pkid { get; set; }
    public byte PublishStatus_pkid { get; set; }

    // Flat FK label fields (read-only, from LEFT JOINs) — used by the list columns.
    public string? PartnerName { get; set; }
    public string? CourseGroupDescription { get; set; }
    public string? PublishStatusDescription { get; set; }

    public DateOnly ScheduleOn { get; set; }
    public DateOnly ScheduleOff { get; set; }
    public short Hour { get; set; }
    public decimal ListPrice { get; set; }
    public decimal LearningCredit { get; set; }

    public string? Material { get; set; }
    public string? Objective { get; set; }
    public string? Target { get; set; }
    public string? Prerequisites { get; set; }
    public string? Outline { get; set; }
    public string? TowardCertOrExam { get; set; }
    public string? Note { get; set; }
    public string? OtherInfo { get; set; }
    public bool CanRepeat { get; set; }

    // N-N: counts for list/query, id lists filled on GET-by-id.
    public int CertificationCount { get; set; }
    public int JobCategoryCount { get; set; }
    public List<int> CertificationPkids { get; set; } = new();
    public List<short> JobCategoryPkids { get; set; } = new();
}

// CourseRequest.cs — write DTO (Pkid carried for UPDATE key; ignored on INSERT)
public class CourseRequest
{
    public int Pkid { get; set; }
    [Required, MaxLength(200)] public string Title { get; set; } = string.Empty;
    [MaxLength(300)] public string? OfficialTitle { get; set; }
    [Required, MaxLength(50)]  public string CourseId { get; set; } = string.Empty;
    [Required, MaxLength(50)]  public string ProdCourseId { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string FriendlyUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }

    public short Partner_pkid { get; set; }
    public short? CourseGroup_pkid { get; set; }
    public byte PublishStatus_pkid { get; set; }

    public DateOnly ScheduleOn { get; set; }
    public DateOnly ScheduleOff { get; set; }
    public short Hour { get; set; }
    public decimal ListPrice { get; set; }
    public decimal LearningCredit { get; set; }

    [MaxLength(500)]  public string? Material { get; set; }
    [MaxLength(4000)] public string? Objective { get; set; }
    [MaxLength(500)]  public string? Target { get; set; }
    [MaxLength(4000)] public string? Prerequisites { get; set; }
    public string? Outline { get; set; }            // nvarchar(max) — no MaxLength
    public string? TowardCertOrExam { get; set; }   // nvarchar(max)
    [MaxLength(4000)] public string? Note { get; set; }
    [MaxLength(4000)] public string? OtherInfo { get; set; }
    public bool CanRepeat { get; set; }

    public List<int> CertificationPkids { get; set; } = new();
    public List<short> JobCategoryPkids { get; set; } = new();
}

// CourseQuery.cs — search DTO
public class CourseQuery
{
    public string? Keyword { get; set; }
    public short? PartnerPkid { get; set; }
    public short? CourseGroupPkid { get; set; }
    public byte? PublishStatusPkid { get; set; }
    public bool? CanRepeat { get; set; }
    public DateOnly? ScheduleOnFrom { get; set; }
    public DateOnly? ScheduleOnTo { get; set; }
    public DateOnly? ScheduleOffFrom { get; set; }
    public DateOnly? ScheduleOffTo { get; set; }
}
```

### SQL — SELECT (GetAll / Query)

Flat FK labels via `LEFT JOIN`; N-N counts via correlated subqueries:
```sql
SELECT c.pkid, c.Title, c.OfficialTitle, c.CourseId, c.ProdCourseId, c.FriendlyUrl,
       c.DisplayOrder, c.Partner_pkid, c.CourseGroup_pkid, c.PublishStatus_pkid,
       p.Name        AS PartnerName,
       g.Description AS CourseGroupDescription,
       s.Description AS PublishStatusDescription,
       c.ScheduleOn, c.ScheduleOff, c.Hour, c.ListPrice, c.LearningCredit,
       c.Material, c.Objective, c.Target, c.Prerequisites, c.Outline,
       c.TowardCertOrExam, c.Note, c.OtherInfo, c.CanRepeat,
       (SELECT COUNT(*) FROM CourseInCertification ic WHERE ic.Course_pkid = c.pkid) AS CertificationCount,
       (SELECT COUNT(*) FROM CourseJobCategories  jc WHERE jc.Course_pkid = c.pkid) AS JobCategoryCount
FROM Course c
LEFT JOIN Partner       p ON p.pkid = c.Partner_pkid
LEFT JOIN CourseGroup   g ON g.pkid = c.CourseGroup_pkid
LEFT JOIN PublishStatus s ON s.pkid = c.PublishStatus_pkid
ORDER BY c.DisplayOrder ASC, c.pkid ASC
```
Query appends keyword LIKE + FK equals + CanRepeat + two date ranges before `ORDER BY`.

### SQL — GetById

Same SELECT with `WHERE c.pkid = @Pkid`, then two follow-up queries on the **same connection**
to fill the id lists:
```sql
SELECT Certification_pkid FROM CourseInCertification WHERE Course_pkid = @Pkid;
SELECT JobCategory_pkid   FROM CourseJobCategories  WHERE Course_pkid = @Pkid;
```

### SQL — INSERT

`pkid` IDENTITY → omit; return new value, then insert junction rows (same txn):
```sql
INSERT INTO Course
  (Title, OfficialTitle, CourseId, ProdCourseId, FriendlyUrl, DisplayOrder,
   Partner_pkid, CourseGroup_pkid, PublishStatus_pkid, ScheduleOn, ScheduleOff,
   Hour, ListPrice, LearningCredit, Material, Objective, Target, Prerequisites,
   Outline, TowardCertOrExam, Note, OtherInfo, CanRepeat)
VALUES
  (@Title, @OfficialTitle, @CourseId, @ProdCourseId, @FriendlyUrl, @DisplayOrder,
   @Partner_pkid, @CourseGroup_pkid, @PublishStatus_pkid, @ScheduleOn, @ScheduleOff,
   @Hour, @ListPrice, @LearningCredit, @Material, @Objective, @Target, @Prerequisites,
   @Outline, @TowardCertOrExam, @Note, @OtherInfo, @CanRepeat);
SELECT CAST(SCOPE_IDENTITY() AS int);
```

### SQL — UPDATE

`pkid` is the WHERE key; then delete+reinsert both junctions (same txn):
```sql
UPDATE Course
SET Title=@Title, OfficialTitle=@OfficialTitle, CourseId=@CourseId, ProdCourseId=@ProdCourseId,
    FriendlyUrl=@FriendlyUrl, DisplayOrder=@DisplayOrder, Partner_pkid=@Partner_pkid,
    CourseGroup_pkid=@CourseGroup_pkid, PublishStatus_pkid=@PublishStatus_pkid,
    ScheduleOn=@ScheduleOn, ScheduleOff=@ScheduleOff, Hour=@Hour, ListPrice=@ListPrice,
    LearningCredit=@LearningCredit, Material=@Material, Objective=@Objective, Target=@Target,
    Prerequisites=@Prerequisites, Outline=@Outline, TowardCertOrExam=@TowardCertOrExam,
    Note=@Note, OtherInfo=@OtherInfo, CanRepeat=@CanRepeat
WHERE pkid=@Pkid;
```

### N-N Sync Pattern

Inside a transaction (both INSERT and UPDATE paths), after the main row is written:
```sql
DELETE FROM CourseInCertification WHERE Course_pkid = @Pkid;
INSERT INTO CourseInCertification (Course_pkid, Certification_pkid) VALUES (@Pkid, @CertificationPkid); -- per id
DELETE FROM CourseJobCategories  WHERE Course_pkid = @Pkid;
INSERT INTO CourseJobCategories  (Course_pkid, JobCategory_pkid)   VALUES (@Pkid, @JobCategoryPkid);   -- per id
```

### Special Column Notes

- **`pkid` `int IDENTITY`** → omit from INSERT; `SELECT CAST(SCOPE_IDENTITY() AS int)`.
- **`ScheduleOn` / `ScheduleOff` are `date`** → C# `DateOnly`; `DateOnlyTypeHandler` already registered in `Program.cs`.
- **`ListPrice decimal(9,0)`**, **`LearningCredit decimal(9,1)`** → C# `decimal`.
- **`Outline` / `TowardCertOrExam` are `nvarchar(max)`** → no `MaxLength` annotation.
- Lookup for **`Certification.Title` is `nchar(100)`** → `RTRIM()` in the certifications lookup SQL.
- FK values come from the client as strings (LookupItem.Id); parse to `short`/`byte`.
  `CourseGroup_pkid` may be null → send/accept null for the "無" option.

---

## Frontend Notes

### Route table

| Path | Component |
|------|-----------|
| `/courses` | list |
| `/courses/new` | form (create) |
| `/courses/:id` | detail |
| `/courses/:id/edit` | form (edit) |

(Route order: `/new` before `/:id`.)

### Angular model

```typescript
export interface Course {
  pkid: number;
  title: string;
  officialTitle: string | null;
  courseId: string;
  prodCourseId: string;
  friendlyUrl: string;
  displayOrder: number;
  partner_pkid: number;
  courseGroup_pkid: number | null;
  publishStatus_pkid: number;
  partnerName: string | null;
  courseGroupDescription: string | null;
  publishStatusDescription: string | null;
  scheduleOn: string;   // ISO date
  scheduleOff: string;  // ISO date
  hour: number;
  listPrice: number;
  learningCredit: number;
  material: string | null;
  objective: string | null;
  target: string | null;
  prerequisites: string | null;
  outline: string | null;
  towardCertOrExam: string | null;
  note: string | null;
  otherInfo: string | null;
  canRepeat: boolean;
  certificationCount: number;
  jobCategoryCount: number;
  certificationPkids: number[];
  jobCategoryPkids: number[];
}

export interface CourseRequest {
  pkid: number;
  title: string;
  officialTitle: string | null;
  courseId: string;
  prodCourseId: string;
  friendlyUrl: string;
  displayOrder: number;
  partner_pkid: number;
  courseGroup_pkid: number | null;
  publishStatus_pkid: number;
  scheduleOn: string;
  scheduleOff: string;
  hour: number;
  listPrice: number;
  learningCredit: number;
  material: string | null;
  objective: string | null;
  target: string | null;
  prerequisites: string | null;
  outline: string | null;
  towardCertOrExam: string | null;
  note: string | null;
  otherInfo: string | null;
  canRepeat: boolean;
  certificationPkids: number[];
  jobCategoryPkids: number[];
}

export interface CourseQuery {
  keyword?: string | null;
  partnerPkid?: number | null;
  courseGroupPkid?: number | null;
  publishStatusPkid?: number | null;
  canRepeat?: boolean | null;
  scheduleOnFrom?: string | null;
  scheduleOnTo?: string | null;
  scheduleOffFrom?: string | null;
  scheduleOffTo?: string | null;
}
```

### List component

- Columns (per request): 主代碼 (pkid), 顯示順序 (displayOrder), 簡介代碼 (courseId),
  科目代碼 (prodCourseId), 課程名稱 (title), 原廠 (partnerName), 課程群組 (courseGroupDescription),
  上架狀態 (publishStatusDescription), 上架日期 (scheduleOn), 下架日期 (scheduleOff),
  時數 (hour), 定價 (listPrice), 點數 (learningCredit), 允許重聽 (canRepeat).
- FK columns bind the flat label fields (`partnerName`, `courseGroupDescription`,
  `publishStatusDescription`) — no client-side lookup join needed for display.
- `canRepeat`: render as ✓ / — (boolean).
- Dates: `date:'yyyy/MM/dd'` (pure `date` columns, no `+ 'Z'` needed — no time component).
- Filter drawer (`p-drawer`): keyword input; three FK `p-select`
  (`appendTo="body"`, `[filter]="true"`); CanRepeat tri-state `p-select`
  (是/否/全部); two date-range pairs (ScheduleOn, ScheduleOff) via `p-datepicker`.
  Load partners / course-groups / publish-statuses lookups via `forkJoin` on init;
  restore saved filters after lookups resolve.
- Default sort `DisplayOrder ASC` (then pkid ASC).
- `confirmDelete` message: `` 確定要刪除主代碼 <b>${item.pkid}</b>「${item.title}」？``

### Detail component

- **Foreign-Primary link buttons (live)**: 原廠 → `/partners/{partner_pkid}`;
  課程群組 → `/course-groups/{courseGroup_pkid}` (only when not null);
  上架狀態 → `/publish-statuses/{publishStatus_pkid}`.
- N-N sections: 對應認證 (certification labels), 職務類別 (job-category labels) — resolve ids to
  labels via the two new lookups.
- No Primary-Foreign link buttons yet (CourseFAQ / CourseRelatedLink / HotCourse not built — deferred).

### Form component

- Reactive form; `forkJoin` for the five lookups on init: partners, course-groups,
  publish-statuses, certifications, job-categories.
- `pkid`: **not shown** (IDENTITY, DB-assigned); carried in the request (0 on create).
- `title`: `p-inputtext`, required, maxlength 200.
- `officialTitle`: `p-inputtext`, optional, maxlength 300.
- `courseId`: `p-inputtext`, required, maxlength 50.
- `prodCourseId`: `p-inputtext`, required, maxlength 50.
- `friendlyUrl`: `p-inputtext`, required, maxlength 100.
- `displayOrder`: `p-inputNumber`, required, min 0.
- `partner_pkid`: `p-select` (partners), required, `appendTo="body"`, `[filter]="true"`.
- `courseGroup_pkid`: `p-select` (course-groups), optional, `[showClear]="true"` for 無.
- `publishStatus_pkid`: `p-select` (publish-statuses), required.
- `scheduleOn`: `p-datepicker`, required. `scheduleOff`: `p-datepicker`, required.
  (Optional convenience: default `scheduleOff` = `scheduleOn` + 10y on create via `valueChanges`,
  `{ emitEvent: false }` — see template §Special Form Behaviors; include if trivial.)
- `hour`: `p-inputNumber`, min 0 (default 0).
- `listPrice`: `p-inputNumber`, min 0, 0 fraction digits (default 0).
- `learningCredit`: `p-inputNumber`, min 0, 1 fraction digit (default 0).
- `material`: `p-inputtext`, maxlength 500. `target`: `p-inputtext`, maxlength 500.
- `objective`, `prerequisites`, `note`, `otherInfo`: `textarea` (`pTextarea`), maxlength 4000.
- `outline`, `towardCertOrExam`: `textarea` (`pTextarea`), no maxlength (`nvarchar(max)`).
- `canRepeat`: `p-checkbox` / `p-toggleswitch` (default false).
- `certificationPkids`: `p-multiselect` (認證), `[maxSelectedLabels]="9999"`.
- `jobCategoryPkids`: `p-multiselect` (職務類別), `[maxSelectedLabels]="9999"`.
- Date convert ISO string ↔ `Date` on load/save; serialize with local date components
  (`core/utils/date.util.ts` `toIso`), never `toISOString()`.

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `course-list-filters` | Last query filter values |
| `course-list-sort` | `{ sortField, sortOrder }` |
| `course-list-page` | `{ first, rows }` |

No incoming cross-entity query params consumed yet (Course is not linked from a built parent
list). When CourseFAQ/etc. are built, they will link *into* Course, not the reverse.

### Sidebar placement

Nav group **課程管理 Course** (already an expandable group containing 合作廠商 Partner and
課程群組 CourseGroup). Add:
- Label: 課程 Course
- Route: `/courses`
- Icon: `pi pi-book`

---

## Files to Create / Modify

### Backend (`CMS.API`)

| File | Action |
|------|--------|
| `Models/Course.cs` | create |
| `Models/CourseRequest.cs` | create |
| `Models/CourseQuery.cs` | create |
| `Repositories/ICourseRepository.cs` | create |
| `Repositories/CourseRepository.cs` | create (Dapper; txn for N-N; LEFT JOIN labels; DateOnly) |
| `Controllers/CoursesController.cs` | create |
| `Repositories/ILookupRepository.cs` | modify — add `GetCertificationsAsync`, `GetJobCategoriesAsync` |
| `Repositories/LookupRepository.cs` | modify — add both lookups (Certification `RTRIM(Title)`; JobCategory `Description`) |
| `Controllers/LookupsController.cs` | modify — add `certifications`, `job-categories` routes |
| `Program.cs` | modify — register `ICourseRepository` |

### Frontend (`CMS.NG`)

| File | Action |
|------|--------|
| `core/models/course.model.ts` | create |
| `core/services/course.service.ts` | create |
| `core/services/lookup.service.ts` | modify — add `getCertifications()`, `getJobCategories()` |
| `features/courses/course-list/` | create |
| `features/courses/course-detail/` | create |
| `features/courses/course-form/` | create |
| `app.routes.ts` | modify — add lazy routes (`/new` before `/:id`) |
| `app.ts` | modify — sidebar entry under 課程管理 Course |

### Tests

| File | Action |
|------|--------|
| `CMS.API.Tests/CoursesControllerTests.cs` | create — list/query, get-by-id (found+404), create, update, delete, required-field 400 |
| `core/services/course.service.spec.ts` | create |
| `features/.../course-list.spec.ts` | create |
| `features/.../course-detail.spec.ts` | create |
| `features/.../course-form.spec.ts` | create |
