import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { PartnerService } from './partner.service';
import { Partner, PartnerQuery, PartnerRequest } from '../models/partner.model';

describe('PartnerService', () => {
  let service: PartnerService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/partners`;

  const sample: Partner = {
    pkid: 1,
    name: '微軟',
    appKey: 'MS',
    nameOnPartnerMenu: '微軟認證課程',
    nameOnCourseDetailPage: '微軟',
    displayOrder: 10,
    imageFilename: 'ms.png',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PartnerService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PartnerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getAll() should GET the collection', () => {
    service.getAll().subscribe((rows) => {
      expect(rows.length).toBe(1);
      expect(rows[0].pkid).toBe(1);
    });
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([sample]);
  });

  it('query() should POST the filter to /query', () => {
    const filter: PartnerQuery = { keyword: '微軟', displayOrderFrom: 1, displayOrderTo: 100 };
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
    const request: PartnerRequest = {
      pkid: 0,
      name: '甲骨文',
      appKey: 'ORA',
      nameOnPartnerMenu: '甲骨文課程',
      nameOnCourseDetailPage: '甲骨文',
      displayOrder: 20,
      imageFilename: null,
    };
    service.create(request).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ ...sample, pkid: 5 });
  });

  it('update() should PUT the request body (no route param)', () => {
    const request: PartnerRequest = {
      pkid: 1,
      name: '微軟',
      appKey: 'MS',
      nameOnPartnerMenu: '微軟認證課程',
      nameOnCourseDetailPage: '微軟',
      displayOrder: 10,
      imageFilename: 'ms.png',
    };
    service.update(request).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush(sample);
  });

  it('delete() should DELETE by numeric pkid', () => {
    service.delete(1).subscribe();
    const req = httpMock.expectOne(`${base}/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
