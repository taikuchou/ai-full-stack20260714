import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { AppRoleForm } from './app-role-form';
import { AppRoleService } from '../../../core/services/app-role.service';
import { AppRole, LookupItem } from '../../../core/models/app-role.model';

const USERS: LookupItem[] = [
  { id: 'helen', label: 'helen (helen)' },
  { id: 'miles', label: 'Miles Sun (miles@uuu.com.tw)' },
];

const ADMIN: AppRole = {
  pkid: 1,
  roleId: 'Admin',
  roleName: 'Administrator',
  permissionLevel: 1,
  description: '系統管理員',
  userCount: 2,
  userIds: ['helen', 'miles'],
};

describe('AppRoleForm', () => {
  let serviceSpy: jasmine.SpyObj<AppRoleService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let routeId: string | null;

  function setup(id: string | null): ComponentFixture<AppRoleForm> {
    routeId = id;
    const fixture = TestBed.createComponent(AppRoleForm);
    fixture.detectChanges(); // triggers ngOnInit
    return fixture;
  }

  beforeEach(async () => {
    routeId = null;
    serviceSpy = jasmine.createSpyObj<AppRoleService>('AppRoleService', [
      'getAppUsers',
      'getById',
      'create',
      'update',
    ]);
    serviceSpy.getAppUsers.and.returnValue(of(USERS));
    serviceSpy.getById.and.returnValue(of(ADMIN));
    serviceSpy.create.and.returnValue(of(ADMIN));
    serviceSpy.update.and.returnValue(of(ADMIN));
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [AppRoleForm],
      providers: [
        provideNoopAnimations(),
        { provide: AppRoleService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_: string) => routeId } } },
        },
      ],
    }).compileComponents();
  });

  describe('add mode', () => {
    it('should be in add mode with RoleId enabled', () => {
      const fixture = setup(null);
      const component = fixture.componentInstance;
      expect(component.isEdit()).toBeFalse();
      expect(component.form.controls.roleId.disabled).toBeFalse();
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
        roleId: 'Editor',
        roleName: 'Editor',
        permissionLevel: 50,
        description: '編輯',
        userIds: ['helen'],
      });
      component.save();

      expect(serviceSpy.create).toHaveBeenCalledTimes(1);
      const arg = serviceSpy.create.calls.mostRecent().args[0];
      expect(arg.roleId).toBe('Editor');
      expect(arg.userIds).toEqual(['helen']);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/app-roles', 'Editor']);
    });
  });

  describe('edit mode', () => {
    it('should load the role, patch the form and disable RoleId', () => {
      const fixture = setup('Admin');
      const component = fixture.componentInstance;
      expect(component.isEdit()).toBeTrue();
      expect(serviceSpy.getById).toHaveBeenCalledWith('Admin');
      expect(component.form.controls.roleName.value).toBe('Administrator');
      expect(component.form.controls.roleId.disabled).toBeTrue();
    });

    it('should call update() (including the disabled RoleId) on save', () => {
      const fixture = setup('Admin');
      const component = fixture.componentInstance;
      component.form.controls.roleName.setValue('Administrator (edited)');
      component.save();

      expect(serviceSpy.update).toHaveBeenCalledTimes(1);
      const arg = serviceSpy.update.calls.mostRecent().args[0];
      expect(arg.roleId).toBe('Admin');
      expect(arg.roleName).toBe('Administrator (edited)');
    });
  });
});
