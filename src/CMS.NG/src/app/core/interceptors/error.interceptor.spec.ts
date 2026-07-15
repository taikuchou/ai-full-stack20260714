import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let messageServiceSpy: jasmine.SpyObj<MessageService>;

  beforeEach(() => {
    messageServiceSpy = jasmine.createSpyObj<MessageService>('MessageService', ['add']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: MessageService, useValue: messageServiceSpy },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  /** Fires a request and answers it with the given status. */
  function respondWith(status: number, body = 'error'): unknown {
    let error: unknown;
    http.get('/api/courses').subscribe({ error: (e) => (error = e) });
    httpMock.expectOne('/api/courses').flush(body, { status, statusText: 'x' });
    return error;
  }

  // ---- Toasts on server-side failures ----

  it('toasts a friendly message on a 500', () => {
    respondWith(500);

    expect(messageServiceSpy.add).toHaveBeenCalledTimes(1);
    const message = messageServiceSpy.add.calls.mostRecent().args[0];
    expect(message.severity).toBe('error');
    expect(message.summary).toContain('系統錯誤');
    expect(message.detail).toBeTruthy();
  });

  it('toasts on other 500-class statuses', () => {
    respondWith(503);
    expect(messageServiceSpy.add).toHaveBeenCalledTimes(1);
  });

  it('toasts when the API is unreachable (status 0)', () => {
    let error: unknown;
    http.get('/api/courses').subscribe({ error: (e) => (error = e) });
    httpMock.expectOne('/api/courses').error(new ProgressEvent('network error'), { status: 0 });

    expect(messageServiceSpy.add).toHaveBeenCalledTimes(1);
    expect(error).toBeTruthy();
  });

  it('never surfaces the raw server body to the user', () => {
    // The API returns a safe generic 500, but the toast must not echo a body regardless.
    respondWith(500, 'Invalid column name. SELECT PasswordHash FROM AppUser');

    const message = messageServiceSpy.add.calls.mostRecent().args[0];
    expect(message.detail).not.toContain('SELECT');
    expect(message.detail).not.toContain('PasswordHash');
  });

  it('still propagates the error so callers can react', () => {
    expect(respondWith(500)).toBeTruthy();
  });

  // ---- Deliberate responses are left alone ----

  it('does not toast on a 401 — the auth interceptor redirects to Login', () => {
    respondWith(401);
    expect(messageServiceSpy.add).not.toHaveBeenCalled();
  });

  it('does not toast on 400/403/404 — pages handle their own answers', () => {
    respondWith(400);
    respondWith(403);
    respondWith(404);
    expect(messageServiceSpy.add).not.toHaveBeenCalled();
  });

  it('does not toast on a successful response', () => {
    http.get('/api/courses').subscribe();
    httpMock.expectOne('/api/courses').flush([]);

    expect(messageServiceSpy.add).not.toHaveBeenCalled();
  });
});
