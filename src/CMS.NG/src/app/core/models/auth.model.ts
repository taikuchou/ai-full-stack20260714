/** Request DTO for POST /api/auth/login. */
export interface LoginRequest {
  userId: string;
  password: string;
}

/** Raw response from POST /api/auth/login. */
export interface LoginResponse {
  userId: string;
  userName: string;
  accessToken: string;
}

/**
 * Request DTO for PUT /api/auth/profile. UserName only — the API takes the account to rename from
 * the JWT, and ignores a userId sent in the body.
 */
export interface UpdateProfileRequest {
  userName: string;
}

/** Raw response from PUT /api/auth/profile. The token is re-issued with the new name. */
export interface UpdateProfileResponse {
  userId: string;
  userName: string;
  accessToken: string;
}

/**
 * Request DTO for POST /api/auth/change-password. Plaintext only — hashing is the server's job and
 * no hash ever crosses this boundary in either direction. The account comes from the JWT.
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

/** What's persisted in session storage — the login response plus roles decoded from the token. */
export interface AuthProfile {
  userId: string;
  userName: string;
  accessToken: string;
  roles: string[];
}
