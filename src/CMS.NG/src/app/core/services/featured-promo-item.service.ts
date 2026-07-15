import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import {
  FeaturedPromoItem,
  FeaturedPromoItemQuery,
  FeaturedPromoItemRequest,
  LookupItem,
  PromoCodeLookup,
} from '../models/featured-promo-item.model';

@Injectable({ providedIn: 'root' })
export class FeaturedPromoItemService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/featured-promo-items`;
  private readonly lookupsUrl = `${environment.apiBaseUrl}/lookups`;

  getAll(): Observable<FeaturedPromoItem[]> {
    return this.http.get<FeaturedPromoItem[]>(this.baseUrl);
  }

  query(query: FeaturedPromoItemQuery): Observable<FeaturedPromoItem[]> {
    return this.http.post<FeaturedPromoItem[]>(`${this.baseUrl}/query`, query);
  }

  getById(pkid: number): Observable<FeaturedPromoItem> {
    // Numeric int PK — no encoding needed.
    return this.http.get<FeaturedPromoItem>(`${this.baseUrl}/${pkid}`);
  }

  create(request: FeaturedPromoItemRequest): Observable<FeaturedPromoItem> {
    return this.http.post<FeaturedPromoItem>(this.baseUrl, request);
  }

  update(request: FeaturedPromoItemRequest): Observable<FeaturedPromoItem> {
    // PUT takes the key (pkid) from the body — no route param.
    return this.http.put<FeaturedPromoItem>(this.baseUrl, request);
  }

  delete(pkid: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${pkid}`);
  }

  /** Move an item one slot: `delta` +1 down (the grid's +), -1 up (-). */
  move(pkid: number, delta: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/move`, { pkid, delta });
  }

  // ---- FK lookups ----

  /** TrainingCenter options for the grid tabs. */
  getTrainingCenters(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.lookupsUrl}/training-centers`);
  }

  /** Promotion2 options for the PromoCode autocomplete. */
  getPromoCodes(): Observable<LookupItem[]> {
    return this.http.get<LookupItem[]>(`${this.lookupsUrl}/promo-codes`);
  }

  /** Resolve a typed PromoCode to its Promotion2 pkid. 404s when no promo carries the code. */
  resolvePromoCode(promoCode: string): Observable<PromoCodeLookup> {
    // PromoCode is free text (a string key) — encode it into the path.
    return this.http.get<PromoCodeLookup>(
      `${this.lookupsUrl}/promo-codes/${encodeURIComponent(promoCode)}`,
    );
  }
}
