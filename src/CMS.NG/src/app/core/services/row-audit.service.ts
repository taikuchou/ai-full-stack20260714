import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { RowAuditHistoryItem } from '../models/row-audit.model';

@Injectable({ providedIn: 'root' })
export class RowAuditService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/rowaudit`;

  /**
   * One record's audit trail, newest first.
   *
   * @param tableName the DB table, e.g. 'Course'
   * @param pkid the record's pkid. On the string-PK tables (AppRole, AppUser) this is still the
   *   numeric `pkid` column, not RoleId/UserId — that is what the writer stores.
   */
  getForRecord(tableName: string, pkid: number | string): Observable<RowAuditHistoryItem[]> {
    const params = new HttpParams().set('tableName', tableName).set('pkid', String(pkid));
    return this.http.get<RowAuditHistoryItem[]>(this.baseUrl, { params });
  }
}
