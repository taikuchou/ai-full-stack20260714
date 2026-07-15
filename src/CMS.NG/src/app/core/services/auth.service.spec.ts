import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';
import { ROLE_CLAIM } from '../utils/jwt.util';

function fakeToken(roles: string[]): string {
  const payload = { [ROLE_CLAIM]: roles };
  const base64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_');
  return `header.${base64}.signature`;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    sessionStorage.clear();
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  it('starts unauthenticated when session storage is empty', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.getToken()).toBeNull();
  });

  it('login() posts credentials, stores the profile in session storage and decodes roles', () => {
    const token = fakeToken(['Admin', 'Editor']);
    let result: unknown;
    service.login('helen', 'secret').subscribe((profile) => (result = profile));

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 'helen', password: 'secret' });
    req.flush({ userId: 'helen', userName: 'Helen Chen', accessToken: token });

    expect(result).toEqual({
      userId: 'helen',
      userName: 'Helen Chen',
      accessToken: token,
      roles: ['Admin', 'Editor'],
    });
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.getToken()).toBe(token);
    expect(service.hasRole('Admin')).toBeTrue();
    expect(service.hasRole('Nope')).toBeFalse();

    const stored = JSON.parse(sessionStorage.getItem('auth-profile')!);
    expect(stored.userId).toBe('helen');
    expect(stored.accessToken).toBe(token);
  });

  it('logout() clears session storage and navigates to /login', () => {
    const token = fakeToken(['Admin']);
    service.login('helen', 'secret').subscribe();
    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush({ userId: 'helen', userName: 'Helen Chen', accessToken: token });

    service.logout();

    expect(service.isAuthenticated()).toBeFalse();
    expect(sessionStorage.getItem('auth-profile')).toBeNull();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('clearSession() clears the session without navigating', () => {
    const token = fakeToken(['Admin']);
    service.login('helen', 'secret').subscribe();
    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush({ userId: 'helen', userName: 'Helen Chen', accessToken: token });

    service.clearSession();

    expect(service.isAuthenticated()).toBeFalse();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });
});
