import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { environment } from '@env/environment';
import {
  AuthProfile,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from '../models/auth.model';
import { decodeJwtRoles } from '../utils/jwt.util';

const STORAGE_KEY = 'auth-profile';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  private readonly _profile = signal<AuthProfile | null>(readStoredProfile());
  readonly profile = this._profile.asReadonly();
  readonly isAuthenticated = computed(() => this._profile() !== null);

  login(userId: string, password: string): Observable<AuthProfile> {
    const request: LoginRequest = { userId, password };
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, request).pipe(
      map(toProfile),
      tap((profile) => this.setProfile(profile)),
    );
  }

  /**
   * Renames the signed-in user. The API takes the account from the token, so no userId is sent.
   * The re-issued token replaces the stored one, refreshing the shell's userName and session storage.
   */
  updateUserName(userName: string): Observable<AuthProfile> {
    const request: UpdateProfileRequest = { userName };
    return this.http.put<UpdateProfileResponse>(`${this.baseUrl}/profile`, request).pipe(
      map(toProfile),
      tap((profile) => this.setProfile(profile)),
    );
  }

  /**
   * Changes the signed-in user's own password. Plaintext over HTTPS; the server hashes and no hash
   * is returned. The session is left alone — the JWT stays valid, since it encodes identity and
   * roles, not the password.
   */
  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/change-password`, request);
  }

  /** Clears the session and returns to the Login page. */
  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  /** Clears the session without navigating — used by the 401 interceptor. */
  clearSession(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    this._profile.set(null);
  }

  getToken(): string | null {
    return this._profile()?.accessToken ?? null;
  }

  hasRole(role: string): boolean {
    return this._profile()?.roles.includes(role) ?? false;
  }

  private setProfile(profile: AuthProfile): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    this._profile.set(profile);
  }
}

/** Roles always come from the token's claims, never from a caller-supplied list. */
function toProfile(response: LoginResponse | UpdateProfileResponse): AuthProfile {
  return {
    userId: response.userId,
    userName: response.userName,
    accessToken: response.accessToken,
    roles: decodeJwtRoles(response.accessToken),
  };
}

function readStoredProfile(): AuthProfile | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthProfile;
  } catch {
    return null;
  }
}
