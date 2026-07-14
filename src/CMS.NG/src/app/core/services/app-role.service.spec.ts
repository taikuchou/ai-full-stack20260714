import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { AppRoleService } from './app-role.service';
import { AppRole, AppRoleQuery, AppRoleRequest } from '../models/app-role.model';

describe('AppRoleService', () => {
  let service: AppRoleService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/approles`;

  const sampleRole: AppRole = {
    pkid: 1,
    roleId: 'Admin',
    roleName: 'Administrator',
    permissionLevel: 1,
    description: '系統管理員',
    userCount: 3,
    userIds: ['helen', 'Jenny_Tsao'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AppRoleService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AppRoleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getAll() should GET the roles collection', () => {
    service.getAll().subscribe((roles) => {
      expect(roles.length).toBe(1);
      expect(roles[0].roleId).toBe('Admin');
    });
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([sampleRole]);
  });

  it('query() should POST the filter to /query', () => {
    const filter: AppRoleQuery = { keyword: 'Admin', permissionLevelFrom: 1, permissionLevelTo: 50 };
    service.query(filter).subscribe((roles) => expect(roles.length).toBe(1));

    const req = httpMock.expectOne(`${base}/query`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(filter);
    req.flush([sampleRole]);
  });

  it('getById() should GET and encode the roleId', () => {
    service.getById('Admin/Root').subscribe((role) => expect(role.roleId).toBe('Admin'));
    const req = httpMock.expectOne(`${base}/Admin%2FRoot`);
    expect(req.request.method).toBe('GET');
    req.flush(sampleRole);
  });

  it('create() should POST the request body', () => {
    const request: AppRoleRequest = {
      roleId: 'Editor',
      roleName: 'Editor',
      permissionLevel: 50,
      description: null,
      userIds: ['helen'],
    };
    service.create(request).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ ...sampleRole, roleId: 'Editor' });
  });

  it('update() should PUT the request body (no route param)', () => {
    const request: AppRoleRequest = {
      roleId: 'Admin',
      roleName: 'Administrator',
      permissionLevel: 1,
      description: '系統管理員',
      userIds: [],
    };
    service.update(request).subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush(sampleRole);
  });

  it('delete() should DELETE by encoded roleId', () => {
    service.delete('Admin').subscribe();
    const req = httpMock.expectOne(`${base}/Admin`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('getAppUsers() should GET the appusers lookup', () => {
    service.getAppUsers().subscribe((users) => expect(users.length).toBe(1));
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/lookups/appusers`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'helen', label: 'helen (helen)' }]);
  });
});
