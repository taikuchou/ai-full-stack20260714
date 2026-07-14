import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService } from 'primeng/api';
import { of } from 'rxjs';

import { AppRoleList } from './app-role-list';
import { AppRoleService } from '../../../core/services/app-role.service';
import { AppRole } from '../../../core/models/app-role.model';

const ROLES: AppRole[] = [
  {
    pkid: 1,
    roleId: 'Admin',
    roleName: 'Administrator',
    permissionLevel: 1,
    description: '系統管理員',
    userCount: 3,
    userIds: [],
  },
  {
    pkid: 2,
    roleId: 'User',
    roleName: 'User',
    permissionLevel: 100,
    description: '一般使用者',
    userCount: 9,
    userIds: [],
  },
];

describe('AppRoleList', () => {
  let fixture: ComponentFixture<AppRoleList>;
  let component: AppRoleList;
  let serviceSpy: jasmine.SpyObj<AppRoleService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<AppRoleService>('AppRoleService', ['query', 'delete']);
    serviceSpy.query.and.returnValue(of(ROLES));
    serviceSpy.delete.and.returnValue(of(void 0));
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [AppRoleList],
      providers: [
        provideNoopAnimations(),
        { provide: AppRoleService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    sessionStorage.clear();
    fixture = TestBed.createComponent(AppRoleList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load roles via query() on init', () => {
    expect(serviceSpy.query).toHaveBeenCalledTimes(1);
    expect(component.roles().length).toBe(2);
  });

  it('applyFilter() should persist filters to sessionStorage and reload', () => {
    component.filter.keyword = 'Admin';
    component.applyFilter();

    const saved = JSON.parse(sessionStorage.getItem('app-role-list-filters')!);
    expect(saved.keyword).toBe('Admin');
    expect(serviceSpy.query).toHaveBeenCalledTimes(2);
  });

  it('add() should navigate to the new-role route', () => {
    component.add();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/app-roles/new']);
  });

  it('confirmDelete() should ask for confirmation and delete on accept', () => {
    // ConfirmationService is provided at the component level, so resolve it from the component injector.
    const confirmationService = fixture.debugElement.injector.get(ConfirmationService);
    const confirmSpy = spyOn(confirmationService, 'confirm').and.callFake((opts: any) => {
      opts.accept();
      return confirmationService;
    });

    component.confirmDelete(ROLES[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(serviceSpy.delete).toHaveBeenCalledWith('Admin');
  });
});
