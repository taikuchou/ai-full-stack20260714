/** Response model for an AppUser (使用者 / 系統使用者). PasswordHash is never exposed. */
export interface AppUser {
  pkid: number;
  userId: string;
  userName: string;
  isActive: boolean;
  /** UTC datetime string (no timezone suffix); append 'Z' before parsing. Null if never set. */
  passwordUpdatedTime: string | null;
  /** Number of roles assigned to this user (via AppUserRole). */
  roleCount: number;
  /** RoleIds assigned to this user. Populated on GET by id. */
  roleIds: string[];
}

/** Write DTO for creating / updating an AppUser. No password field. */
export interface AppUserRequest {
  userId: string;
  userName: string;
  isActive: boolean;
  roleIds: string[];
}

/** Search DTO for the list filter drawer. */
export interface AppUserQuery {
  keyword?: string | null;
  isActive?: boolean | null;
}

/** Slim option item for select / multiselect controls. */
export interface LookupItem {
  id: string;
  label: string;
}
