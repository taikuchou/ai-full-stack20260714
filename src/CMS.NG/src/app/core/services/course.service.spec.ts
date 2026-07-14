import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { CourseService } from './course.service';
import { Course, CourseQuery, CourseRequest } from '../models/course.model';

describe('CourseService', () => {
  let service: CourseService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/courses`;
  const lookups = `${environment.apiBaseUrl}/lookups`;

  const sample: Course = {
    pkid: 1,
    title: 'Azure 基礎課程',
    officialTitle: 'Microsoft Azure Fundamentals',
    courseId: 'AZ-900',
    prodCourseId: 'PROD-AZ900',
    friendlyUrl: 'azure-fundamentals',
    displayOrder: 10,
    partner_pkid: 1,
    courseGroup_pkid: 2,
    publishStatus_pkid: 1,
    partnerName: '微軟',
    courseGroupDescription: '雲端課程',
    publishStatusDescription: '已發布',
    scheduleOn: '2026-01-01',
    scheduleOff: '2036-01-01',
    hour: 8,
    listPrice: 12000,
    learningCredit: 3,
    material: null,
    objective: null,
    target: null,
    prerequisites: null,
    outline: null,
    towardCertOrExam: null,
    note: null,
    otherInfo: null,
    canRepeat: true,
    certificationCount: 1,
    jobCategoryCount: 2,
    certificationPkids: [5],
    jobCategoryPkids: [3, 4],
  };

  function request(pkid = 0): CourseRequest {
    return {
      pkid,
      title: sample.title,
      officialTitle: sample.officialTitle,
      courseId: sample.courseId,
      prodCourseId: sample.prodCourseId,
      friendlyUrl: sample.friendlyUrl,
      displayOrder: sample.displayOrder,
      partner_pkid: sample.partner_pkid,
      courseGroup_pkid: sample.courseGroup_pkid,
      publishStatus_pkid: sample.publishStatus_pkid,
      scheduleOn: sample.scheduleOn,
      scheduleOff: sample.scheduleOff,
      hour: sample.hour,
      listPrice: sample.listPrice,
      learningCredit: sample.learningCredit,
      material: null,
      objective: null,
      target: null,
      prerequisites: null,
      outline: null,
      towardCertOrExam: null,
      note: null,
      otherInfo: null,
      canRepeat: sample.canRepeat,
      certificationPkids: [5],
      jobCategoryPkids: [3, 4],
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CourseService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CourseService);
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

  it('query() should POST the filter to /query', () => {
    const filter: CourseQuery = { keyword: 'Azure', partnerPkid: 1, canRepeat: true };
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

  it('getCertifications() should GET the certifications lookup', () => {
    service.getCertifications().subscribe();
    const req = httpMock.expectOne(`${lookups}/certifications`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getJobCategories() should GET the job-categories lookup', () => {
    service.getJobCategories().subscribe();
    const req = httpMock.expectOne(`${lookups}/job-categories`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
