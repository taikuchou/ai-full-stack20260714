# Build Spec for AppUser
- database schema: `.\database\auth.sql`

---

## Summary

`AppUser` is a system user account. It is the counterpart of `AppRole`: the primary key is the
string column `UserId` (`pkid` is an IDENTITY surfaced for display only), and it has an N-N
relationship with `AppRole` through the junction table `AppUserRole`. The `PasswordHash` column is
managed **entirely server-side** — it is never sent to or received from the frontend.

| Item | Detail |
|------|--------|
| Primary Key | `UserId` `nvarchar(200)` (string PK). `pkid` int IDENTITY is display-only (主代碼) |
| Foreign Keys | N/A on `AppUser` itself |
| Required Fields | `UserId`, `UserName`, `IsActive`, `PasswordHash` (server-set) |
| N-N Relationships | `AppUserRole` (AppUser ↔ AppRole) |
| Primary-Foreign Links | N/A — the only table referencing `AppUser.UserId` is the `AppUserRole` junction (handled as N-N) |
| Query Filters | keyword (UserId, UserName), IsActive (tri-state bool) |
| Default Sort | `UserId ASC` |

---

## Localization

### Chinese Table Name

- AppUser: 使用者
- Description: 系統使用者帳號主資料

### Chinese Column Names

- pkid: 主代碼
- UserId: 使用者代碼
- UserName: 使用者名稱
- IsActive: 啟用狀態
- PasswordHash: 密碼雜湊（後端專用，不對外）
- PasswordUpdatedTime: 密碼更新時間

---

## Required Fields

Required (NOT NULL, excluding the IDENTITY display key):
- `UserId` — string PK, editable in **new**, disabled in **edit**
- `UserName`
- `IsActive` (defaults to `true` / 1)
- `PasswordHash` — **not a form field**; set server-side (see Password Handling below)

Optional (nullable):
- `PasswordUpdatedTime` — set server-side when the password is written

---

## Foreign Keys

**N/A** — `AppUser` has no outbound FK columns.

---

## Foreign-Primary Links

**N/A**

---

## Primary-Foreign Links

The only table with a FK to `AppUser.UserId` is `AppUserRole` (the junction table for the
AppUser ↔ AppRole N-N). It is modelled as an N-N relationship rather than a child-list link, so
there are no Primary-Foreign navigation buttons. **N/A**

---

## N-N Relationships

### AppUserRole — AppUser ↔ AppRole

Junction table: `AppUserRole` (`UserId`, `RoleId`). This is the reverse of the AppRole feature's
`UserIds` relationship.

- **List / Detail view**: show a `RoleCount` (correlated subquery) in the list; show the assigned
  role labels as chips in the detail view.
- **Form (edit + new)**: `p-multiSelect` of roles, `display="chip"`, filterable.
- Request field: `RoleIds` (`List<string>`), carried in `AppUserRequest`, populated on GET-by-id.
- Sync pattern on save (inside the create/update transaction):
  1. `DELETE FROM AppUserRole WHERE UserId = @UserId`
  2. Bulk `INSERT INTO AppUserRole (UserId, RoleId) VALUES (@UserId, @RoleId)` for each distinct role.
- On delete: remove `AppUserRole` rows first (FK_AppUserRole_AppUser), then the `AppUser` row.

---

## Password Handling (special — backend only)

`PasswordHash` is **never** exposed to or accepted from the frontend. It is excluded from
`AppUserRequest`, from the `AppUser` response model, and from all Angular models.

- **On CREATE**: read `SysConfig.configValue` where `configKey = 'appConfig'`. The value is a JSON
  object; extract its `defaultPassword` property. Hash that string with **SHA-256** (stored as
  uppercase hex) and write it to `PasswordHash`. Also set `PasswordUpdatedTime = GETUTCDATE()`
  because a password was just established.
- **On UPDATE**: do **not** modify `PasswordHash` or `PasswordUpdatedTime`. The UPDATE statement
  only touches `UserName` and `IsActive` (plus the role sync).
- **Reset endpoint**: `POST /api/appusers/{id}/reset-password` re-reads the `appConfig`
  `defaultPassword`, re-hashes it, and updates `PasswordHash` + `PasswordUpdatedTime = GETUTCDATE()`.
  This is the only path (besides create) that writes the hash. Returns `404` if the user is missing,
  `204 No Content` on success.

---

## Query Filters

- **keyword**: string — LIKE on `UserId`, `UserName`.
- **IsActive**: `bool?` — tri-state exact match (`null` = no filter, `true` = 啟用, `false` = 停用).

`PasswordUpdatedTime` is nullable and rarely useful as a filter — omitted.

---

## Lookup Endpoints Required

| Route | Status | Returns |
|-------|--------|---------|
| `GET /api/lookups/approles` | **New** | AppRole options — `Id = RoleId`, `Label = "RoleName (RoleId)"`, ordered by RoleName |

(The existing `GET /api/lookups/appusers` is the AppRole feature's users lookup and is unrelated to
this feature's form.)

---

## API Endpoints

| Method | Route | Notes |
|--------|-------|-------|
| `GET` | `/api/appusers` | List all |
| `POST` | `/api/appusers/query` | Filtered query (body: `AppUserQuery`) |
| `GET` | `/api/appusers/{id}` | Get by UserId (string PK), includes `RoleIds` |
| `POST` | `/api/appusers` | Create (sets default password hash) |
| `PUT` | `/api/appusers` | Update (UserId from body; does not touch password) |
| `DELETE` | `/api/appusers/{id}` | Delete |
| `POST` | `/api/appusers/{id}/reset-password` | Reset password to the configured default |

String PK: route `{id}` (no `:int`); Angular `encodeURIComponent(id)`.

---

## Backend Notes

### Models

```csharp
// AppUser.cs — response (PasswordHash intentionally absent)
public class AppUser
{
    public int Pkid { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime? PasswordUpdatedTime { get; set; }
    public int RoleCount { get; set; }               // n-n count via AppUserRole
    public List<string> RoleIds { get; set; } = [];  // populated on GET by id
}

// AppUserRequest.cs — write DTO (no PasswordHash)
public class AppUserRequest
{
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public List<string> RoleIds { get; set; } = [];
}

// AppUserQuery.cs — search DTO
public class AppUserQuery
{
    public string? Keyword { get; set; }
    public bool? IsActive { get; set; }
}
```

### SQL — SELECT (list/view; PasswordHash never selected)

```sql
SELECT u.pkid AS Pkid, u.UserId AS UserId, u.UserName AS UserName,
       u.IsActive AS IsActive, u.PasswordUpdatedTime AS PasswordUpdatedTime,
       (SELECT COUNT(*) FROM AppUserRole ur WHERE ur.UserId = u.UserId) AS RoleCount
FROM AppUser u
```

GET-by-id adds a second result set: `SELECT ur.RoleId FROM AppUserRole ur WHERE ur.UserId = @UserId ORDER BY ur.RoleId`.

### SQL — INSERT

```sql
INSERT INTO AppUser (UserId, UserName, IsActive, PasswordHash, PasswordUpdatedTime)
VALUES (@UserId, @UserName, @IsActive, @PasswordHash, GETUTCDATE());
```
`@PasswordHash` = SHA-256(hex) of the `appConfig.defaultPassword`.

### SQL — UPDATE (password untouched)

```sql
UPDATE AppUser SET UserName = @UserName, IsActive = @IsActive WHERE UserId = @UserId;
```

### SQL — reset password

```sql
UPDATE AppUser SET PasswordHash = @PasswordHash, PasswordUpdatedTime = GETUTCDATE() WHERE UserId = @UserId;
```

### Default password / hashing

- `SELECT configValue FROM SysConfig WHERE configKey = 'appConfig'` → `JsonDocument` → `defaultPassword`.
- `Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plain)))` (uppercase hex).

### Special Column Notes

- `PasswordHash` — excluded from response model, Request DTO, and all SELECTs shown to the client.
- `PasswordUpdatedTime` `datetime` — stored UTC (`GETUTCDATE()`); frontend appends `'Z'` before parsing.

---

## Frontend Notes

### Files

- `core/models/app-user.model.ts`, `core/services/app-user.service.ts`
- `features/app-users/app-user-list|-detail|-form/`
- Route already reserved in the sidebar (系統管理 Admin › 使用者 AppUser → `/app-users`); add the lazy routes.

### List

Columns: 主代碼, 使用者代碼 (key), 使用者名稱, 啟用狀態 (是/否 tag), 角色數 (RoleCount),
密碼更新時間 (`{{ passwordUpdatedTime + 'Z' | date:'yyyy-MM-dd HH:mm' }}`).
Filter drawer: keyword input + IsActive `p-select` (全部 / 啟用 / 停用). Session keys
`app-user-list-filters` / `-sort` / `-page`. Default sort `userId ASC`.

Delete confirm: `確定要刪除主代碼 <b>${item.pkid}</b>「${item.userId}」？`

### Detail

Cards: 使用者資料 (pkid, userId, userName, isActive, passwordUpdatedTime) and 角色 (role chips).
A 重設密碼 button in the toolbar calls `resetPassword(userId)` (confirm dialog first).

### Form

Reactive form: `userId` (disabled in edit), `userName` (required), `isActive`
(`p-toggleswitch`/checkbox), `roleIds` (`p-multiSelect` of `/lookups/approles`). **No password field.**
`forkJoin` loads roles lookup (+ existing user in edit).

### Session Storage Keys

| Key | Contents |
|-----|----------|
| `app-user-list-filters` | Last query filter values |
| `app-user-list-sort` | `{ sortField, sortOrder }` |
| `app-user-list-page` | `{ first, rows }` |

---

## Files to Create / Modify

**Backend (CMS.API)** — create: `Models/AppUser.cs`, `AppUserRequest.cs`, `AppUserQuery.cs`;
`Repositories/IAppUserRepository.cs`, `AppUserRepository.cs`; `Controllers/AppUsersController.cs`.
Modify: `Program.cs` (DI), `Controllers/LookupsController.cs`, `Repositories/ILookupRepository.cs`,
`Repositories/LookupRepository.cs` (add `approles` lookup).

**Frontend (CMS.NG)** — create: `core/models/app-user.model.ts`, `core/services/app-user.service.ts`;
`features/app-users/app-user-list|-detail|-form/` (ts/html/scss). Modify: `app.routes.ts`
(sidebar entry already present in `app.ts`).

**Tests** — `CMS.API.Tests/AppUsersControllerTests.cs`; `app-user.service.spec.ts`,
`app-user-list.spec.ts`, `app-user-form.spec.ts`.
