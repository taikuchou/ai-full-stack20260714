/** Response model for a PublishStatus (發布狀態). */
export interface PublishStatus {
  /** Status code (狀態代碼). User-assigned tinyint primary key. */
  pkid: number;
  description: string;
  isDraft: boolean;
  isPublished: boolean;
  isDiscontinued: boolean;
}

/** Write DTO for creating / updating a PublishStatus. `pkid` is the user-assigned key. */
export interface PublishStatusRequest {
  pkid: number;
  description: string;
  isDraft: boolean;
  isPublished: boolean;
  isDiscontinued: boolean;
}

/** Search DTO for the list filter drawer. */
export interface PublishStatusQuery {
  keyword?: string | null;
  isDraft?: boolean | null;
  isPublished?: boolean | null;
  isDiscontinued?: boolean | null;
}
