import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { AppUserService } from './app-user.service';
import { AppUser, AppUserQuery, AppUserRequest } from '../models/app-user.model';

describe('AppUserService', () => {
  let service: AppUserService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/appusers`;

  const sampleUser: AppUser = {
    pkid: 1,
    userId: 'helen',
    userName: 'Helen Chen',
    isActive: true,
    passwordUpdatedTime: '2026-01-01T00:00:00',
    roleCount: 2,
    roleIds: ['Admin', 'Editor'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AppUserService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AppUserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getAll() should GET the users collection', () => {
    service.getAll().subscribe((users) => {
      expect(users.length).toBe(1);
      expect(users[0].userId).toBe('helen');
    });
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([sampleUser]);
  });

  it('query() should POST the filter to /query', () => {
    const filter: AppUserQuery = { keyword: 'helen', isActive: true };
    service.query(filter).subscribe((users) => expect(users.length).toBe(1));

    const req = httpMock.expectOne(`${base}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(filter);
    req.flush([sampleUser]);
  });

  it('getById() should GET and encode the userId', () => {
    service.getById('domain\\helen').subscribe((user) => expect(user.userId).toBe('helen'));
    const req = httpMock.expectOne(`${base}/domain%5Chelen`);
    expect(req.request.method).toBe('GET');
    req.flush(sampleUser);
  });

  it('create() should POST the request body', () => {
    const request: AppUserRequest = {
      userId: 'miles',
      userName: 'Miles Sun',
      isActive: true,
      roleIds: ['Editor'],
    };
    service.create(request).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ ...sampleUser, userId: 'miles' });
  });

  it('update() should PUT the request body (no route param)', () => {
    const request: AppUserRequest = {
      userId: 'helen',
      userName: 'Helen Chen',
      isActive: false,
      roleIds: [],
    };
    service.update(request).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush(sampleUser);
  });

  it('delete() should DELETE by encoded userId', () => {
    service.delete('helen').subscribe();
    const req = httpMock.expectOne(`${base}/helen`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('resetPassword() should POST to the reset-password route (encoded id)', () => {
    service.resetPassword('helen').subscribe();
    const req = httpMock.expectOne(`${base}/helen/reset-password`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('getAppRoles() should GET the approles lookup', () => {
    service.getAppRoles().subscribe((roles) => expect(roles.length).toBe(1));
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/lookups/approles`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'Admin', label: 'Administrator (Admin)' }]);
  });
});
