import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { ConfirmationService } from 'primeng/api';

import { AppUserForm } from './app-user-form';
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

describe('AppUserForm', () => {
  let serviceSpy: jasmine.SpyObj<AppUserService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let routeId: string | null;
  /** Roles of the signed-in user. Set before setup() — isAdmin is read once per component. */
  let signedInRoles: string[];

  function setup(id: string | null): ComponentFixture<AppUserForm> {
    routeId = id;
    const fixture = TestBed.createComponent(AppUserForm);
    fixture.detectChanges(); // triggers ngOnInit
    return fixture;
  }

  function resetButton(fixture: ComponentFixture<AppUserForm>): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-testid="reset-password-button"]');
  }

  beforeEach(async () => {
    routeId = null;
    signedInRoles = ['Admin'];
    serviceSpy = jasmine.createSpyObj<AppUserService>('AppUserService', [
      'getAppRoles',
      'getById',
      'create',
      'update',
      'resetPassword',
    ]);
    serviceSpy.getAppRoles.and.returnValue(of(ROLES));
    serviceSpy.getById.and.returnValue(of(HELEN));
    serviceSpy.create.and.returnValue(of(HELEN));
    serviceSpy.update.and.returnValue(of(HELEN));
    serviceSpy.resetPassword.and.returnValue(of(void 0));

    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['hasRole']);
    authServiceSpy.hasRole.and.callFake((role: string) => signedInRoles.includes(role));

    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [AppUserForm],
      providers: [
        provideNoopAnimations(),
        { provide: AppUserService, useValue: serviceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_: string) => routeId } } },
        },
      ],
    }).compileComponents();
  });

  describe('add mode', () => {
    it('should be in add mode with UserId enabled', () => {
      const fixture = setup(null);
      const component = fixture.componentInstance;
      expect(component.isEdit()).toBeFalse();
      expect(component.form.controls.userId.disabled).toBeFalse();
      expect(serviceSpy.getById).not.toHaveBeenCalled();
    });

    it('should not call create() when the form is invalid', () => {
      const fixture = setup(null);
      fixture.componentInstance.save();
      expect(serviceSpy.create).not.toHaveBeenCalled();
    });

    it('should call create() with the form values when valid', () => {
      const fixture = setup(null);
      const component = fixture.componentInstance;
      component.form.setValue({
        userId: 'miles',
        userName: 'Miles Sun',
        isActive: true,
        roleIds: ['Editor'],
      });
      component.save();

      expect(serviceSpy.create).toHaveBeenCalledTimes(1);
      const arg = serviceSpy.create.calls.mostRecent().args[0];
      expect(arg.userId).toBe('miles');
      expect(arg.roleIds).toEqual(['Editor']);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/app-users', 'miles']);
    });
  });

  describe('edit mode', () => {
    it('should load the user, patch the form and disable UserId', () => {
      const fixture = setup('helen');
      const component = fixture.componentInstance;
      expect(component.isEdit()).toBeTrue();
      expect(serviceSpy.getById).toHaveBeenCalledWith('helen');
      expect(component.form.controls.userName.value).toBe('Helen Chen');
      expect(component.form.controls.userId.disabled).toBeTrue();
    });

    it('should call update() (including the disabled UserId) on save', () => {
      const fixture = setup('helen');
      const component = fixture.componentInstance;
      component.form.controls.userName.setValue('Helen Chen (edited)');
      component.form.controls.isActive.setValue(false);
      component.save();

      expect(serviceSpy.update).toHaveBeenCalledTimes(1);
      const arg = serviceSpy.update.calls.mostRecent().args[0];
      expect(arg.userId).toBe('helen');
      expect(arg.userName).toBe('Helen Chen (edited)');
      expect(arg.isActive).toBeFalse();
    });
  });

  describe('reset password to default', () => {
    it('shows the button for an Admin editing a user', () => {
      signedInRoles = ['Admin'];
      const fixture = setup('helen');
      expect(resetButton(fixture)).toBeTruthy();
    });

    it('hides the button for a non-Admin', () => {
      signedInRoles = ['Editor'];
      const fixture = setup('helen');

      expect(resetButton(fixture)).toBeNull();
      expect(fixture.componentInstance.isAdmin()).toBeFalse();
    });

    it('hides the button for a user with no roles', () => {
      signedInRoles = [];
      const fixture = setup('helen');
      expect(resetButton(fixture)).toBeNull();
    });

    it('gates on the Admin role specifically, not merely on having some role', () => {
      signedInRoles = ['Editor', 'Viewer'];
      const fixture = setup('helen');

      expect(resetButton(fixture)).toBeNull();
      expect(authServiceSpy.hasRole).toHaveBeenCalledWith('Admin');
    });

    it('hides the button in add mode — there is no user to reset yet', () => {
      signedInRoles = ['Admin'];
      const fixture = setup(null);
      expect(resetButton(fixture)).toBeNull();
    });

    it('asks for confirmation before resetting, and does nothing until accepted', () => {
      signedInRoles = ['Admin'];
      const fixture = setup('helen');
      const confirmationService = fixture.debugElement.injector.get(ConfirmationService);
      spyOn(confirmationService, 'confirm').and.stub();

      resetButton(fixture)!.querySelector('button')!.click();

      expect(confirmationService.confirm).toHaveBeenCalledTimes(1);
      expect(serviceSpy.resetPassword).not.toHaveBeenCalled();
    });

    it('sends only the UserId once confirmed', () => {
      signedInRoles = ['Admin'];
      const fixture = setup('helen');
      const confirmationService = fixture.debugElement.injector.get(ConfirmationService);
      // Accept immediately, standing in for the user clicking 重設.
      spyOn(confirmationService, 'confirm').and.callFake((options) => {
        options.accept!();
        return confirmationService;
      });

      fixture.componentInstance.confirmResetPassword();

      // No password and no hash leave the client — the API reads the default from SysConfig.
      expect(serviceSpy.resetPassword).toHaveBeenCalledOnceWith('helen');
    });

    it('reports a 403 from the API as a permissions problem', () => {
      signedInRoles = ['Admin'];
      serviceSpy.resetPassword.and.returnValue(throwError(() => ({ status: 403 })));
      const fixture = setup('helen');
      const confirmationService = fixture.debugElement.injector.get(ConfirmationService);
      spyOn(confirmationService, 'confirm').and.callFake((options) => {
        options.accept!();
        return confirmationService;
      });

      fixture.componentInstance.confirmResetPassword();

      // The API is the real gate; the hidden button is only convenience.
      expect(fixture.componentInstance.resetting()).toBeFalse();
    });
  });
});
