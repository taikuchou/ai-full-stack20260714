/** Response model for an AppRole (角色 / 使用者角色). */
export interface AppRole {
  pkid: number;
  roleId: string;
  roleName: string;
  permissionLevel: number;
  description: string | null;
  /** Number of users assigned to this role (via AppUserRole). */
  userCount: number;
  /** UserIds assigned to this role. Populated on GET by id. */
  userIds: string[];
}

/** Write DTO for creating / updating an AppRole. */
export interface AppRoleRequest {
  roleId: string;
  roleName: string;
  permissionLevel: number;
  description: string | null;
  userIds: string[];
}

/** Search DTO for the list filter drawer. */
export interface AppRoleQuery {
  keyword?: string | null;
  permissionLevelFrom?: number | null;
  permissionLevelTo?: number | null;
}

/** Slim option item for select / multiselect controls. */
export interface LookupItem {
  id: string;
  label: string;
}
