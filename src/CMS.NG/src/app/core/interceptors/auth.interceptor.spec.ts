import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['getToken', 'logout']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches the Bearer token when one is present', () => {
    authServiceSpy.getToken.and.returnValue('abc.def.ghi');

    http.get('/api/approles').subscribe();

    const req = httpMock.expectOne('/api/approles');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc.def.ghi');
    req.flush([]);
  });

  it('does not attach an Authorization header when there is no token', () => {
    authServiceSpy.getToken.and.returnValue(null);

    http.get('/api/approles').subscribe();

    const req = httpMock.expectOne('/api/approles');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush([]);
  });

  it('logs out on a 401 response and still surfaces the error', () => {
    authServiceSpy.getToken.and.returnValue('expired-token');

    let error: unknown;
    http.get('/api/approles').subscribe({ error: (e) => (error = e) });

    httpMock.expectOne('/api/approles').flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.logout).toHaveBeenCalledTimes(1);
    expect(error).toBeTruthy();
  });

  it('does not log out on a non-401 error', () => {
    authServiceSpy.getToken.and.returnValue('a-token');

    http.get('/api/approles').subscribe({ error: () => {} });

    httpMock.expectOne('/api/approles').flush('Server error', { status: 500, statusText: 'Server Error' });

    expect(authServiceSpy.logout).not.toHaveBeenCalled();
  });
});
