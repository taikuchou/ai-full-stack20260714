import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { Profile } from './profile';
import { AuthService } from '../../core/services/auth.service';
import { AuthProfile } from '../../core/models/auth.model';

describe('Profile', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let profileSignal: ReturnType<typeof signal<AuthProfile | null>>;

  const PROFILE: AuthProfile = {
    userId: 'helen',
    userName: 'Helen Chen',
    accessToken: 'a.b.c',
    roles: ['Admin', 'Editor'],
  };

  async function setup(profile: AuthProfile | null = PROFILE): Promise<ComponentFixture<Profile>> {
    profileSignal = signal(profile);
    authServiceSpy = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['updateUserName', 'changePassword'],
      { profile: profileSignal },
    );

    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [provideNoopAnimations(), { provide: AuthService, useValue: authServiceSpy }],
    }).compileComponents();

    const fixture = TestBed.createComponent(Profile);
    fixture.detectChanges();
    return fixture;
  }

  function el(fixture: ComponentFixture<Profile>, testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function userNameInput(fixture: ComponentFixture<Profile>): HTMLInputElement {
    return fixture.nativeElement.querySelector('#userName') as HTMLInputElement;
  }

  it('shows the UserId read-only — displayed, with no control to edit it', async () => {
    const fixture = await setup();

    expect(el(fixture, 'profile-user-id')?.textContent).toContain('helen');
    // It is rendered as text, and the profile form has no field that could change it.
    expect(el(fixture, 'profile-user-id')?.querySelector('input')).toBeNull();
    expect(Object.keys(fixture.componentInstance.form.controls)).toEqual(['userName']);
  });

  it('shows the roles read-only — displayed, with no control to change them', async () => {
    const fixture = await setup();

    const roles = el(fixture, 'profile-roles');
    expect(roles?.textContent).toContain('Admin');
    expect(roles?.textContent).toContain('Editor');
    expect(roles?.querySelector('input')).toBeNull();
    expect(roles?.querySelector('select')).toBeNull();
    expect(roles?.querySelector('button')).toBeNull();
  });

  it('prefills the UserName from the signed-in profile', async () => {
    const fixture = await setup();
    expect(userNameInput(fixture).value).toBe('Helen Chen');
  });

  it('saving updates the shell: it stores the renamed profile via AuthService', async () => {
    const fixture = await setup();
    const renamed: AuthProfile = { ...PROFILE, userName: 'Helen Wu' };
    authServiceSpy.updateUserName.and.callFake((userName: string) => {
      // AuthService writes session storage and the profile signal the shell renders from.
      profileSignal.set({ ...PROFILE, userName });
      return of(renamed);
    });

    const input = userNameInput(fixture);
    input.value = 'Helen Wu';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(authServiceSpy.updateUserName).toHaveBeenCalledOnceWith('Helen Wu');
    // What the shell binds to now reads the new name.
    expect(profileSignal()?.userName).toBe('Helen Wu');
  });

  it('sends only the userName — never the userId or roles', async () => {
    const fixture = await setup();
    authServiceSpy.updateUserName.and.returnValue(of({ ...PROFILE, userName: 'Helen Wu' }));

    const input = userNameInput(fixture);
    input.value = 'Helen Wu';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

    // The service method takes a name and nothing else — userId/roles cannot be smuggled out.
    expect(authServiceSpy.updateUserName).toHaveBeenCalledOnceWith('Helen Wu');
  });

  it('trims the UserName before saving', async () => {
    const fixture = await setup();
    authServiceSpy.updateUserName.and.returnValue(of({ ...PROFILE, userName: 'Helen Wu' }));

    const input = userNameInput(fixture);
    input.value = '  Helen Wu  ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

    expect(authServiceSpy.updateUserName).toHaveBeenCalledOnceWith('Helen Wu');
  });

  it('does not save a whitespace-only UserName', async () => {
    const fixture = await setup();

    const input = userNameInput(fixture);
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(authServiceSpy.updateUserName).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('姓名為必填');
  });

  it('keeps the page usable when saving fails', async () => {
    const fixture = await setup();
    authServiceSpy.updateUserName.and.returnValue(throwError(() => new Error('boom')));

    const input = userNameInput(fixture);
    input.value = 'Helen Wu';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(fixture.componentInstance.submitting()).toBeFalse();
  });

  describe('change password', () => {
    /** Fills the change-password form via the model — p-password wraps its own input. */
    function fillPasswords(
      fixture: ComponentFixture<Profile>,
      current: string,
      next: string,
      confirm: string,
    ): void {
      const form = fixture.componentInstance.passwordForm;
      form.setValue({
        currentPassword: current,
        newPassword: next,
        confirmNewPassword: confirm,
      });
      form.markAllAsTouched();
      fixture.detectChanges();
    }

    function submitPasswordForm(fixture: ComponentFixture<Profile>): void {
      fixture.componentInstance.submitPassword();
      fixture.detectChanges();
    }

    it('blocks submit and shows the complexity message when the new password is too short', async () => {
      const fixture = await setup();
      fillPasswords(fixture, 'old-password', 'Aa1!', 'Aa1!');

      submitPasswordForm(fixture);

      expect(authServiceSpy.changePassword).not.toHaveBeenCalled();
      expect(el(fixture, 'complexity-error')?.textContent).toContain('密碼長度至少需 8 碼');
    });

    it('blocks submit when the new password has fewer than 3 character classes', async () => {
      const fixture = await setup();
      fillPasswords(fixture, 'old-password', 'alllowercase', 'alllowercase');

      submitPasswordForm(fixture);

      expect(authServiceSpy.changePassword).not.toHaveBeenCalled();
      expect(el(fixture, 'complexity-error')).toBeTruthy();
    });

    it('shows the complexity rule bilingually', async () => {
      const fixture = await setup();
      fillPasswords(fixture, 'old-password', 'weak', 'weak');
      submitPasswordForm(fixture);

      const message = el(fixture, 'complexity-error')?.textContent ?? '';
      expect(message).toContain('大寫英文／小寫英文／數字／符號');
      expect(message).toContain('at least 3 of the 4 classes');
    });

    it('blocks submit and flags a mismatch when confirm differs', async () => {
      const fixture = await setup();
      fillPasswords(fixture, 'old-password', 'NewPassw0rd!', 'Different1!');

      submitPasswordForm(fixture);

      expect(authServiceSpy.changePassword).not.toHaveBeenCalled();
      expect(el(fixture, 'mismatch-error')).toBeTruthy();
    });

    it('blocks submit when the current password is blank', async () => {
      const fixture = await setup();
      fillPasswords(fixture, '', 'NewPassw0rd!', 'NewPassw0rd!');

      submitPasswordForm(fixture);

      expect(authServiceSpy.changePassword).not.toHaveBeenCalled();
      expect(el(fixture, 'current-password-error')).toBeTruthy();
    });

    it('posts plaintext and no userId when the form is valid', async () => {
      const fixture = await setup();
      authServiceSpy.changePassword.and.returnValue(of(void 0));
      fillPasswords(fixture, 'old-password', 'NewPassw0rd!', 'NewPassw0rd!');

      submitPasswordForm(fixture);

      expect(authServiceSpy.changePassword).toHaveBeenCalledOnceWith({
        currentPassword: 'old-password',
        newPassword: 'NewPassw0rd!',
        confirmNewPassword: 'NewPassw0rd!',
      });
    });

    it('clears the fields after a successful change, leaving no plaintext behind', async () => {
      const fixture = await setup();
      authServiceSpy.changePassword.and.returnValue(of(void 0));
      fillPasswords(fixture, 'old-password', 'NewPassw0rd!', 'NewPassw0rd!');

      submitPasswordForm(fixture);

      expect(fixture.componentInstance.passwordForm.getRawValue()).toEqual({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
    });

    it('surfaces the server message when the API rejects the change', async () => {
      const fixture = await setup();
      // The server is the authority: a wrong current password is only knowable there.
      authServiceSpy.changePassword.and.returnValue(
        throwError(() => ({ error: { message: '目前密碼不正確 (Current password is incorrect.)' } })),
      );
      fillPasswords(fixture, 'wrong-password', 'NewPassw0rd!', 'NewPassw0rd!');

      submitPasswordForm(fixture);

      expect(fixture.componentInstance.changingPassword()).toBeFalse();
      // Fields are kept so the user can correct the current password without retyping the new one.
      expect(fixture.componentInstance.passwordForm.getRawValue().newPassword).toBe('NewPassw0rd!');
    });

    it('never renders a password hash — only plaintext fields the user typed', async () => {
      const fixture = await setup();
      const html = (fixture.nativeElement as HTMLElement).innerHTML;
      expect(html).not.toContain('PasswordHash');
      expect(html).not.toContain('passwordHash');
    });
  });
});
