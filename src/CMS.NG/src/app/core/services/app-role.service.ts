import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  AppRole,
  AppRoleQuery,
  AppRoleRequest,
  LookupItem,
} from '../models/app-role.model';

@Injectable({ providedIn: 'root' })
export class AppRoleService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/approles`;
  private readonly lookupsUrl = `${environment.apiBaseUrl}/lookups`;

  getAll(): Observable<AppRole[]> {
    return this.http.get<AppRole[]>(this.baseUrl);
  }

  query(query: AppRoleQuery): Observable<AppRole[]> {
    return this.http.post<AppRole[]>(`${this.baseUrl}/query`, query);
  }

  getById(roleId: string): Observable<AppRole> {
    // String PK: encode so ids containing reserved characters route correctly.
    return this.http.get<AppRole>(`${this.baseUrl}/${encodeURIComponent(roleId)}`);
  }

  create(request: AppRoleRequest): Observable<AppRole> {
    return this.http.post<AppRole>(this.baseUrl, request);
  }

  update(request: AppRoleRequest): Observable<AppRole> {
    // PUT takes the key (roleId) from the body — no route param.
    return this.http.put<AppRole>(this.baseUrl, request);
  }

  delete(roleId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(roleId)}`);
  }

  /** AppUser options for the role-assignment multiselect. */
  getAppUsers(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.lookupsUrl}/appusers`);
  }
}
