# Code Generation Patterns

## Backend

  ### Models
  - `{TABLE}.cs` — response model (flat aliased fields for FK labels, subquery counts for n-n)
  - `{TABLE}Request.cs` — write DTO (FK pkids only; n-n as `List<int>`)
  - `{TABLE}Query.cs` — search DTO (Keyword?, FK pkids?, bool fields?, date ranges?)

  ### Repository
  - `I{TABLE}Repository.cs` + `{TABLE}Repository.cs`
  - Dapper only (no EF).
  - `nchar` columns: always `RTRIM()` in SQL
  - n-n: delete-then-reinsert **in a transaction** on update; separate query on same connection for read
  - n-n counts on list/read: correlated subquery. Id lists: filled on GET-by-id only.

  ### Foreign keys
  - Expose FK labels as **flat aliased read-only fields** on the response model
    (`PartnerName`, `CourseGroupDescription`, …) populated by `LEFT JOIN` — **not** Dapper multi-map
    nav objects. `Course` is the reference implementation.
  - Nullable FK → `LEFT JOIN`, a 無 option, and `[showClear]` on the `p-select`.
  - Detail pages link Foreign→Primary (this entity → its FK targets). Links to entities that are
    **not built yet are deferred** — do not scaffold dead routes.

  ### Primary key variants
  Pick the row matching the DB column; each names a built feature to copy.

  | PK in schema | C# | Form (new / edit) | INSERT | Copy from |
  |---|---|---|---|---|
  | `nvarchar` (string) | `string` | input / **disabled** | includes PK | `AppRole`, `AppUser` |
  | `tinyint`, user-assigned | `byte` | input / **disabled** | includes `pkid`, **no** `SCOPE_IDENTITY` | `PublishStatus` |
  | `smallint IDENTITY` | `short` | **no input** | omits pkid; `SELECT CAST(SCOPE_IDENTITY() AS smallint)` | `Partner`, `CourseGroup` |
  | `int IDENTITY` | `int` | **no input** | omits pkid; `SCOPE_IDENTITY` | `Course` |

  - IDENTITY-assigned PKs: `{TABLE}Request.Pkid` carries the UPDATE key.
  - On a string-PK table, any additional IDENTITY `pkid` column is **display-only**.
  - Multi-word entities take a **kebab-case plural** route (`/api/course-groups`).
  - **Never copy `FeaturedPromoItem`.** It shares the `int IDENTITY` row above but is a *customized*
    CRUD (weekly schedule grid, inline cell form, no routed form/detail) — copy `Course` for that PK
    variant instead. See [../docs/features.md](../docs/features.md) for what it deviates on and why.

  ### Controller
  - Route: `/api/{tablePlural}`; `PUT` takes pkid from body (no route param)
  - String PKs: route `{id}` (no `:int` constraint); service uses `encodeURIComponent`
  - `DateOnly`/`TimeOnly` fields: register Dapper type handlers (already in Program.cs)
  
 ## Frontend

  ### Files
  - `features/{table-plural}/{table}-list/`
  - `features/{table-plural}/{table}-detail/`
  - `features/{table-plural}/{table}-form/`

  ### List page
  - Session storage keys: `{table}-list-filters`, `{table}-list-sort`, `{table}-list-page`
  - Sortable/paginated `p-table`; filter drawer (`p-drawer`)
  - `p-select` in drawer: always `appendTo="body"`; mapped `{ pkid, label }[]` getter; `[filter]="true"` for 10+ options
  - `p-select` / `p-multiselect` with 100+ items: add `[virtualScroll]="true" [virtualScrollItemSize]="43"`

  ### Form page
  - Reactive Forms; `forkJoin` for parallel lookup calls on init
  - `p-datepicker`: convert ISO string ↔ `Date` on load/save using **local** date components
    (inline `toIso`/`parseDate` helpers — there is no `core/utils/`). Never `toISOString()`: it
    shifts the date by the UTC offset.
  - String PK: disabled in edit, editable in new
  - `p-datepicker [timeOnly]="true"` for `time` columns; `parseTime`/`toTimeStr` helpers
  - `p-multiselect` for n-n: `[maxSelectedLabels]="9999"`; wrap chips via `::ng-deep`

  ### Sidebar nav
  - Add entry under the appropriate nav group in `app.html` / `app.ts`
  
 
  ## Special Types

  | Column type | Handling |
  |-------------|---------|
  | `nchar(n)` | `RTRIM()` in all SQL SELECTs |
  | `time(7)` | C# `TimeOnly` via `TimeOnlyTypeHandler`; display with `\| slice:0:5`; `p-datepicker [timeOnly]` in form |
  | `date` | C# `DateOnly` via `DateOnlyTypeHandler`; `p-datepicker` in form (local components — see Form page) |
  | `bit` | Tri-state filter on the list (true / false / any) |
  | PK columns | See **Primary key variants** above |
  | `nvarchar` PK (string) | Controller route `{id}` (no `:int`); service calls `encodeURIComponent(id)` | 
  
  
   ## API Endpoints

  | Method | Route | Description |
  |--------|-------|-------------|
  | GET    | `/api/{plural}` | All records |
  | POST   | `/api/{plural}/query` | Filtered search |
  | GET    | `/api/{plural}/{id}` | Single record |
  | POST   | `/api/{plural}` | Create |
  | PUT    | `/api/{plural}` | Update (pkid in body) |
  | DELETE | `/api/{plural}/{id}` | Delete |
  | GET    | `/api/lookups/{plural}` | Slim lookup list (if used as FK target) |

  ## App wiring

  Project-wide plumbing a new feature slots into — it already exists; do not re-invent it.

  ### Backend
  - `IDbConnectionFactory` reads `ConnectionStrings:CMS`; CORS origins come from `Cors:AllowedOrigins`.
  - `DateOnly`/`TimeOnly` Dapper type handlers are registered in `Program.cs`.
  - Authentication is on: a global `AuthorizeFilter` (`Program.cs`) already requires a valid Bearer
    token on **every** endpoint, so a scaffolded controller needs **no** auth wiring and no
    `[Authorize]`. Opting *out* is what takes an explicit `[AllowAnonymous]` — put it on the
    **action**, never the controller, since it short-circuits authorization for every action it
    covers and an action-level `[Authorize]` cannot win it back. `AuthController` is the reference.
    See [../docs/features.md](../docs/features.md) (Auth).
  - The signed-in user comes from the token: `User.FindFirstValue(ClaimTypes.NameIdentifier)`. Never
    take the acting user's identity from a request body — see `AuthController.UpdateProfile`.
  - Role-restricted endpoints take `[Authorize(Roles = AppRoles.Admin)]` on the **action**
    (`AppUsersController.ResetPassword` is the reference). Enforce the role server-side; hiding the
    button is convenience, not access control.

  ### Frontend
  - Shared code lives in `core/models/`, `core/services/`, `core/guards/`, `core/interceptors/` and
    `core/utils/` (`jwt.util.ts`). Note the **date/time helpers stay inline in each form** — see
    Form page above; `core/utils/` is not the place for them.
  - API base URL comes from `environment.ts` / `environment.development.ts` (swapped by
    `fileReplacements` in `angular.json`); import it as `@env/environment`.
  - PrimeNG theme `Aura`, configured in `app.config.ts`. The shell is Ultima; the sidebar menu is
    the `sections` signal in `app.ts` / `app.html`.
  - Topbar brand text is `CMS` (`app.html`, `.logo-text`).