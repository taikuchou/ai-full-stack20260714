import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { environment } from '@env/environment';
import { AuthProfile, LoginRequest, LoginResponse } from '../models/auth.model';
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
      map((response): AuthProfile => ({
        userId: response.userId,
        userName: response.userName,
        accessToken: response.accessToken,
        roles: decodeJwtRoles(response.accessToken),
      })),
      tap((profile) => this.setProfile(profile)),
    );
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

function readStoredProfile(): AuthProfile | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthProfile;
  } catch {
    return null;
  }
}
