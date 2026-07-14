import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { PublishStatusService } from './publish-status.service';
import {
  PublishStatus,
  PublishStatusQuery,
  PublishStatusRequest,
} from '../models/publish-status.model';

describe('PublishStatusService', () => {
  let service: PublishStatusService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/publish-statuses`;

  const sample: PublishStatus = {
    pkid: 1,
    description: '草稿',
    isDraft: true,
    isPublished: false,
    isDiscontinued: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PublishStatusService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PublishStatusService);
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
    const filter: PublishStatusQuery = { keyword: '草稿', isDraft: true, isPublished: null, isDiscontinued: null };
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
    const request: PublishStatusRequest = {
      pkid: 5,
      description: '已發布',
      isDraft: false,
      isPublished: true,
      isDiscontinued: false,
    };
    service.create(request).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ ...sample, pkid: 5 });
  });

  it('update() should PUT the request body (no route param)', () => {
    const request: PublishStatusRequest = {
      pkid: 1,
      description: '草稿',
      isDraft: true,
      isPublished: false,
      isDiscontinued: false,
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
