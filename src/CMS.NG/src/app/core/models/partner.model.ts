/** Response model for a Partner (合作廠商). */
export interface Partner {
  /** Primary key (主代碼). smallint IDENTITY, database-assigned. */
  pkid: number;
  name: string;
  appKey: string;
  nameOnPartnerMenu: string;
  nameOnCourseDetailPage: string;
  displayOrder: number;
  imageFilename: string | null;
}

/** Write DTO for creating / updating a Partner. `pkid` is DB-assigned (0 on create). */
export interface PartnerRequest {
  pkid: number;
  name: string;
  appKey: string;
  nameOnPartnerMenu: string;
  nameOnCourseDetailPage: string;
  displayOrder: number;
  imageFilename: string | null;
}

/** Search DTO for the list filter drawer. */
export interface PartnerQuery {
  keyword?: string | null;
  displayOrderFrom?: number | null;
  displayOrderTo?: number | null;
}
