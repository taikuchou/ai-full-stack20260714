import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  AppUser,
  AppUserQuery,
  AppUserRequest,
  LookupItem,
} from '../models/app-user.model';

@Injectable({ providedIn: 'root' })
export class AppUserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/appusers`;
  private readonly lookupsUrl = `${environment.apiBaseUrl}/lookups`;

  getAll(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(this.baseUrl);
  }

  query(query: AppUserQuery): Observable<AppUser[]> {
    return this.http.post<AppUser[]>(`${this.baseUrl}/query`, query);
  }

  getById(userId: string): Observable<AppUser> {
    // String PK: encode so ids containing reserved characters route correctly.
    return this.http.get<AppUser>(`${this.baseUrl}/${encodeURIComponent(userId)}`);
  }

  create(request: AppUserRequest): Observable<AppUser> {
    return this.http.post<AppUser>(this.baseUrl, request);
  }

  update(request: AppUserRequest): Observable<AppUser> {
    // PUT takes the key (userId) from the body — no route param. Never touches the password.
    return this.http.put<AppUser>(this.baseUrl, request);
  }

  delete(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(userId)}`);
  }

  /** Reset the user's password to the configured default. */
  resetPassword(userId: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/${encodeURIComponent(userId)}/reset-password`,
      {},
    );
  }

  /** AppRole options for the role-assignment multiselect. */
  getAppRoles(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.lookupsUrl}/approles`);
  }
}
