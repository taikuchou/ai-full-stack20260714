import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService } from 'primeng/api';
import { of } from 'rxjs';

import { AppUserList } from './app-user-list';
import { AppUserService } from '../../../core/services/app-user.service';
import { AppUser } from '../../../core/models/app-user.model';

const USERS: AppUser[] = [
  {
    pkid: 1,
    userId: 'helen',
    userName: 'Helen Chen',
    isActive: true,
    passwordUpdatedTime: '2026-01-01T00:00:00',
    roleCount: 2,
    roleIds: [],
  },
  {
    pkid: 2,
    userId: 'miles',
    userName: 'Miles Sun',
    isActive: false,
    passwordUpdatedTime: null,
    roleCount: 0,
    roleIds: [],
  },
];

describe('AppUserList', () => {
  let fixture: ComponentFixture<AppUserList>;
  let component: AppUserList;
  let serviceSpy: jasmine.SpyObj<AppUserService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<AppUserService>('AppUserService', ['query', 'delete']);
    serviceSpy.query.and.returnValue(of(USERS));
    serviceSpy.delete.and.returnValue(of(void 0));
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [AppUserList],
      providers: [
        provideNoopAnimations(),
        { provide: AppUserService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    sessionStorage.clear();
    fixture = TestBed.createComponent(AppUserList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load users via query() on init', () => {
    expect(serviceSpy.query).toHaveBeenCalledTimes(1);
    expect(component.users().length).toBe(2);
  });

  it('applyFilter() should persist filters to sessionStorage and reload', () => {
    component.filter.keyword = 'helen';
    component.filter.isActive = true;
    component.applyFilter();

    const saved = JSON.parse(sessionStorage.getItem('app-user-list-filters')!);
    expect(saved.keyword).toBe('helen');
    expect(saved.isActive).toBe(true);
    expect(serviceSpy.query).toHaveBeenCalledTimes(2);
  });

  it('add() should navigate to the new-user route', () => {
    component.add();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/app-users/new']);
  });

  it('confirmDelete() should ask for confirmation and delete on accept', () => {
    const confirmationService = fixture.debugElement.injector.get(ConfirmationService);
    const confirmSpy = spyOn(confirmationService, 'confirm').and.callFake((opts: any) => {
      opts.accept();
      return confirmationService;
    });

    component.confirmDelete(USERS[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(serviceSpy.delete).toHaveBeenCalledWith('helen');
  });
});
