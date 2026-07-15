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

/** What's persisted in session storage — the login response plus roles decoded from the token. */
export interface AuthProfile {
  userId: string;
  userName: string;
  accessToken: string;
  roles: string[];
}
