import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { AppUserDetail } from './app-user-detail';
import { AppUserService } from '../../../core/services/app-user.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppUser, LookupItem } from '../../../core/models/app-user.model';

const ROLES: LookupItem[] = [
  { id: 'Admin', label: 'Administrator (Admin)' },
  { id: 'Editor', label: 'Editor (Editor)' },
];

const HELEN: AppUser = {
  pkid: 1,
  userId: 'helen',
  userName: 'Helen Chen',
  isActive: true,
  passwordUpdatedTime: '2026-01-01T00:00:00',
  roleCount: 2,
  roleIds: ['Admin', 'Editor'],
};

describe('AppUserDetail', () => {
  let serviceSpy: jasmine.SpyObj<AppUserService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  /** Roles of the signed-in user — not HELEN's. Set before setup(). */
  let signedInRoles: string[];

  function setup(): ComponentFixture<AppUserDetail> {
    const fixture = TestBed.createComponent(AppUserDetail);
    fixture.detectChanges();
    return fixture;
  }

  function resetButton(fixture: ComponentFixture<AppUserDetail>): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-testid="reset-password-button"]');
  }

  beforeEach(async () => {
    signedInRoles = ['Admin'];
    serviceSpy = jasmine.createSpyObj<AppUserService>('AppUserService', [
      'getById',
      'getAppRoles',
      'resetPassword',
    ]);
    serviceSpy.getById.and.returnValue(of(HELEN));
    serviceSpy.getAppRoles.and.returnValue(of(ROLES));
    serviceSpy.resetPassword.and.returnValue(of(void 0));

    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['hasRole']);
    authServiceSpy.hasRole.and.callFake((role: string) => signedInRoles.includes(role));

    await TestBed.configureTestingModule({
      imports: [AppUserDetail],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppUserService, useValue: serviceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_: string) => 'helen' } } },
        },
      ],
    }).compileComponents();
  });

  it('shows the reset button for an Admin', () => {
    signedInRoles = ['Admin'];
    expect(resetButton(setup())).toBeTruthy();
  });

  it('hides the reset button for a non-Admin', () => {
    signedInRoles = ['Editor'];
    expect(resetButton(setup())).toBeNull();
  });

  it('gates on the viewer\'s own roles, not the roles of the user being viewed', () => {
    // HELEN has the Admin role, but the signed-in viewer does not — the button must stay hidden.
    signedInRoles = ['Editor'];
    const fixture = setup();

    expect(fixture.componentInstance.user()?.roleIds).toContain('Admin');
    expect(resetButton(fixture)).toBeNull();
  });
});
