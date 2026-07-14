/** Response model for a Course (課程). */
export interface Course {
  /** Primary key (主代碼). int IDENTITY, database-assigned. */
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

  /** FK label fields (read-only, resolved server-side via JOIN) — used by the list columns. */
  partnerName: string | null;
  courseGroupDescription: string | null;
  publishStatusDescription: string | null;

  /** ISO date strings (yyyy-MM-dd). Pure `date` columns — no timezone component. */
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

  /** Count of linked certifications / job categories. Populated in list/view. */
  certificationCount: number;
  jobCategoryCount: number;
  /** Linked pkids. Populated on GET by id. */
  certificationPkids: number[];
  jobCategoryPkids: number[];
}

/** Write DTO for creating / updating a Course. `pkid` is DB-assigned (0 on create). */
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

/** Search DTO for the list filter drawer. */
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

/** Slim option item for select / multiselect controls. */
export interface LookupItem {
  id: string;
  label: string;
}
