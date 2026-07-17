import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { FeaturedPromoItemService } from './featured-promo-item.service';
import {
  FeaturedPromoItem,
  FeaturedPromoItemQuery,
  FeaturedPromoItemRequest,
  PromoCodeLookup,
} from '../models/featured-promo-item.model';

describe('FeaturedPromoItemService', () => {
  let service: FeaturedPromoItemService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/featured-promo-items`;
  const lookups = `${environment.apiBaseUrl}/lookups`;

  const sample: FeaturedPromoItem = {
    pkid: 1,
    scheduleOn: '2026-03-16',
    trainingCenter_pkid: 1,
    slot: 1,
    promotion_pkid: 20,
    topic: '成為能AI協作的程式設計師',
    description: '轉職就業養成班，三大主流語言任你選',
    trainingCenterName: '台北',
    promoCode: '20251204_SkillTrainAI',
  };

  function request(pkid = 0): FeaturedPromoItemRequest {
    return {
      pkid,
      scheduleOn: sample.scheduleOn,
      trainingCenter_pkid: sample.trainingCenter_pkid,
      slot: sample.slot,
      promotion_pkid: sample.promotion_pkid,
      topic: sample.topic,
      description: sample.description,
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FeaturedPromoItemService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FeaturedPromoItemService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getAll() should GET the collection', () => {
    service.getAll().subscribe((rows) => expect(rows.length).toBe(1));
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([sample]);
  });

  it('query() should POST the week + centre filter to /query', () => {
    const filter: FeaturedPromoItemQuery = { trainingCenterPkid: 1, weekStart: '2026-03-16' };
    service.query(filter).subscribe((rows) => expect(rows.length).toBe(1));

    const req = httpMock.expectOne(`${base}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(filter);
    req.flush([sample]);
  });

  it('getById() should GET by numeric pkid', () => {
    service.getById(1).subscribe((row) => expect(row.pkid).toBe(1));
    const req = httpMock.expectOne(`${base}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(sample);
  });

  it('create() should POST the request body', () => {
    const body = request(0);
    service.create(body).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ ...sample, pkid: 5 });
  });

  it('update() should PUT the request body (no route param)', () => {
    const body = request(1);
    service.update(body).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush(sample);
  });

  it('delete() should DELETE by numeric pkid', () => {
    service.delete(1).subscribe();
    const req = httpMock.expectOne(`${base}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('move() should POST the pkid and delta to /move', () => {
    service.move(1, 1).subscribe();
    const req = httpMock.expectOne(`${base}/move`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ pkid: 1, delta: 1 });
    req.flush(null);
  });

  it('move() should carry a negative delta for the up arrow', () => {
    service.move(2, -1).subscribe();
    const req = httpMock.expectOne(`${base}/move`);
    expect(req.request.body).toEqual({ pkid: 2, delta: -1 });
    req.flush(null);
  });

  // ---- lookups ----

  it('getTrainingCenters() should GET the training-centers lookup', () => {
    service.getTrainingCenters().subscribe();
    const req = httpMock.expectOne(`${lookups}/training-centers`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getPromoCodes() should GET the promo-codes lookup', () => {
    service.getPromoCodes().subscribe();
    const req = httpMock.expectOne(`${lookups}/promo-codes`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('resolvePromoCode() should GET the code and return its Promotion pkid', () => {
    const promo: PromoCodeLookup = {
      pkid: 20,
      promoCode: '20251204_SkillTrainAI',
      topic: sample.topic,
      description: sample.description,
    };
    service.resolvePromoCode('20251204_SkillTrainAI').subscribe((p) => expect(p.pkid).toBe(20));

    const req = httpMock.expectOne(`${lookups}/promo-codes/20251204_SkillTrainAI`);
    expect(req.request.method).toBe('GET');
    req.flush(promo);
  });

  it('resolvePromoCode() should URL-encode a code containing path-unsafe characters', () => {
    service.resolvePromoCode('AI/2026 Q1').subscribe();

    const req = httpMock.expectOne(`${lookups}/promo-codes/${encodeURIComponent('AI/2026 Q1')}`);
    expect(req.request.method).toBe('GET');
    req.flush({ pkid: 1, promoCode: 'AI/2026 Q1', topic: '', description: '' });
  });
});
