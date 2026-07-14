/** Response model for a CourseGroup (課程群組). */
export interface CourseGroup {
  /** Primary key (主代碼). smallint IDENTITY, database-assigned. */
  pkid: number;
  description: string;
}

/** Write DTO for creating / updating a CourseGroup. `pkid` is DB-assigned (0 on create). */
export interface CourseGroupRequest {
  pkid: number;
  description: string;
}

/** Search DTO for the list filter drawer. */
export interface CourseGroupQuery {
  keyword?: string | null;
}
