import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { environment } from '@env/environment';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  const dummyUrlTree = {} as UrlTree;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.returnValue(dummyUrlTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  function runGuard() {
    return TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
  }

  it('allows navigation when authenticated', () => {
    authServiceSpy.isAuthenticated.and.returnValue(true);

    expect(runGuard()).toBeTrue();
    expect(routerSpy.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to /login when not authenticated', () => {
    authServiceSpy.isAuthenticated.and.returnValue(false);

    expect(runGuard()).toBe(dummyUrlTree);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  describe('when environment.authDisabled is set', () => {
    // The specs build against environment.ts (no fileReplacements on the test target), so the
    // flag is off by default here — flip it for these two and restore after.
    beforeEach(() => (environment.authDisabled = true));
    afterEach(() => (environment.authDisabled = false));

    it('allows navigation without consulting AuthService', () => {
      authServiceSpy.isAuthenticated.and.returnValue(false);

      expect(runGuard()).toBeTrue();
      expect(authServiceSpy.isAuthenticated).not.toHaveBeenCalled();
      expect(routerSpy.createUrlTree).not.toHaveBeenCalled();
    });

    it('is off in the production environment file', () => {
      environment.authDisabled = false;
      authServiceSpy.isAuthenticated.and.returnValue(false);

      expect(runGuard()).toBe(dummyUrlTree);
    });
  });
});
