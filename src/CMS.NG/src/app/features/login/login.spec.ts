import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { Login } from './login';
import { AuthService } from '../../core/services/auth.service';
import { AuthProfile } from '../../core/models/auth.model';

describe('Login', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const PROFILE: AuthProfile = {
    userId: 'helen',
    userName: 'Helen Chen',
    accessToken: 'a.b.c',
    roles: ['Admin'],
  };

  function setup(): ComponentFixture<Login> {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideNoopAnimations(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();
  });

  it('does not call login() when the form is invalid', () => {
    const fixture = setup();
    fixture.componentInstance.submit();
    expect(authServiceSpy.login).not.toHaveBeenCalled();
  });

  it('calls AuthService.login() and navigates home on success', () => {
    authServiceSpy.login.and.returnValue(of(PROFILE));
    const fixture = setup();
    const component = fixture.componentInstance;
    component.form.setValue({ userId: 'helen', password: 'correct-password' });

    component.submit();

    expect(authServiceSpy.login).toHaveBeenCalledWith('helen', 'correct-password');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
  });

  it('stays on the page and does not navigate when login fails', () => {
    authServiceSpy.login.and.returnValue(throwError(() => ({ status: 401 })));
    const fixture = setup();
    const component = fixture.componentInstance;
    component.form.setValue({ userId: 'helen', password: 'wrong-password' });

    component.submit();

    expect(authServiceSpy.login).toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
    expect(component.submitting()).toBeFalse();
  });
});
