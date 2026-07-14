import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Course, CourseQuery, CourseRequest, LookupItem } from '../models/course.model';

@Injectable({ providedIn: 'root' })
export class CourseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/courses`;
  private readonly lookupsUrl = `${environment.apiBaseUrl}/lookups`;

  getAll(): Observable<Course[]> {
    return this.http.get<Course[]>(this.baseUrl);
  }

  query(query: CourseQuery): Observable<Course[]> {
    return this.http.post<Course[]>(`${this.baseUrl}/query`, query);
  }

  getById(pkid: number): Observable<Course> {
    // Numeric int PK — no encoding needed.
    return this.http.get<Course>(`${this.baseUrl}/${pkid}`);
  }

  create(request: CourseRequest): Observable<Course> {
    return this.http.post<Course>(this.baseUrl, request);
  }

  update(request: CourseRequest): Observable<Course> {
    // PUT takes the key (pkid) from the body — no route param.
    return this.http.put<Course>(this.baseUrl, request);
  }

  delete(pkid: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${pkid}`);
  }

  // ---- FK / n-n lookups ----

  /** Partner options for the 原廠 dropdown. */
  getPartners(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.lookupsUrl}/partners`);
  }

  /** CourseGroup options for the 課程群組 dropdown. */
  getCourseGroups(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.lookupsUrl}/course-groups`);
  }

  /** PublishStatus options for the 上架狀態 dropdown. */
  getPublishStatuses(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.lookupsUrl}/publish-statuses`);
  }

  /** Certification options for the 對應認證 multiselect. */
  getCertifications(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.lookupsUrl}/certifications`);
  }

  /** JobCategory options for the 職務類別 multiselect. */
  getJobCategories(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.lookupsUrl}/job-categories`);
  }
}
