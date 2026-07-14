import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { AppUserForm } from './app-user-form';
import { AppUserService } from '../../../core/services/app-user.service';
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
  let routerSpy: jasmine.SpyObj<Router>;
  let routeId: string | null;

  function setup(id: string | null): ComponentFixture<AppUserForm> {
    routeId = id;
    const fixture = TestBed.createComponent(AppUserForm);
    fixture.detectChanges(); // triggers ngOnInit
    return fixture;
  }

  beforeEach(async () => {
    routeId = null;
    serviceSpy = jasmine.createSpyObj<AppUserService>('AppUserService', [
      'getAppRoles',
      'getById',
      'create',
      'update',
    ]);
    serviceSpy.getAppRoles.and.returnValue(of(ROLES));
    serviceSpy.getById.and.returnValue(of(HELEN));
    serviceSpy.create.and.returnValue(of(HELEN));
    serviceSpy.update.and.returnValue(of(HELEN));
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [AppUserForm],
      providers: [
        provideNoopAnimations(),
        { provide: AppUserService, useValue: serviceSpy },
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
});
