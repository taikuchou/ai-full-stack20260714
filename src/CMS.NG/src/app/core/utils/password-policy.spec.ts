import { FormBuilder } from '@angular/forms';
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  isPasswordCompliant,
  passwordComplexityValidator,
  passwordsMatchValidator,
} from './password-policy';

describe('password-policy', () => {
  describe('isPasswordCompliant', () => {
    it('rejects anything shorter than 8, even with all four classes', () => {
      expect(isPasswordCompliant('Aa1!')).toBeFalse();
      expect(isPasswordCompliant('Aa1!bcd')).toBeFalse(); // 7
    });

    it('accepts exactly 8 with 3 classes — the boundary', () => {
      expect(isPasswordCompliant('Passw0rd')).toBeTrue();
    });

    it('rejects a long password carrying only two classes', () => {
      expect(isPasswordCompliant('alllowercase')).toBeFalse();
      expect(isPasswordCompliant('ALLUPPERCASE')).toBeFalse();
      expect(isPasswordCompliant('lowerandupper')).toBeFalse();
      expect(isPasswordCompliant('lowercase123')).toBeFalse();
      expect(isPasswordCompliant('12345678!!')).toBeFalse();
    });

    it('accepts each valid 3-of-4 combination', () => {
      expect(isPasswordCompliant('Passw0rd')).toBeTrue(); // upper + lower + digit
      expect(isPasswordCompliant('Password!')).toBeTrue(); // upper + lower + symbol
      expect(isPasswordCompliant('PASSW0RD!')).toBeTrue(); // upper + digit + symbol
      expect(isPasswordCompliant('passw0rd!')).toBeTrue(); // lower + digit + symbol
    });

    it('accepts all four classes', () => {
      expect(isPasswordCompliant('NewPassw0rd!')).toBeTrue();
    });

    it('counts a space as a symbol', () => {
      expect(isPasswordCompliant('Pass word')).toBeTrue(); // upper + lower + symbol
    });

    it('treats accented letters by case, tracking the server rather than an ASCII check', () => {
      // 'É' is uppercase and 'é' lowercase to the server's char.IsUpper/IsLower.
      expect(isPasswordCompliant('ÉÉÉéééé1')).toBeTrue(); // upper + lower + digit
    });

    it('handles empty input without throwing', () => {
      expect(isPasswordCompliant('')).toBeFalse();
    });
  });

  describe('passwordComplexityValidator', () => {
    const fb = new FormBuilder();

    it('flags passwordComplexity on a non-compliant value', () => {
      const control = fb.nonNullable.control('weak', [passwordComplexityValidator]);
      expect(control.hasError('passwordComplexity')).toBeTrue();
    });

    it('passes a compliant value', () => {
      const control = fb.nonNullable.control('NewPassw0rd!', [passwordComplexityValidator]);
      expect(control.valid).toBeTrue();
    });

    it('stays quiet on an empty value, leaving that to Validators.required', () => {
      const control = fb.nonNullable.control('', [passwordComplexityValidator]);
      expect(control.hasError('passwordComplexity')).toBeFalse();
    });
  });

  describe('passwordsMatchValidator', () => {
    const fb = new FormBuilder();
    const makeGroup = (next: string, confirm: string) =>
      fb.nonNullable.group(
        { newPassword: next, confirmNewPassword: confirm },
        { validators: [passwordsMatchValidator('newPassword', 'confirmNewPassword')] },
      );

    it('flags passwordMismatch when the two differ', () => {
      expect(makeGroup('NewPassw0rd!', 'Different1!').hasError('passwordMismatch')).toBeTrue();
    });

    it('passes when they match', () => {
      expect(makeGroup('NewPassw0rd!', 'NewPassw0rd!').hasError('passwordMismatch')).toBeFalse();
    });

    it('is case-sensitive', () => {
      expect(makeGroup('NewPassw0rd!', 'newpassw0rd!').hasError('passwordMismatch')).toBeTrue();
    });

    it('stays quiet while confirm is still empty', () => {
      expect(makeGroup('NewPassw0rd!', '').hasError('passwordMismatch')).toBeFalse();
    });

    it('re-evaluates when the new password changes after confirm was typed', () => {
      const group = makeGroup('NewPassw0rd!', 'NewPassw0rd!');
      expect(group.hasError('passwordMismatch')).toBeFalse();

      group.controls.newPassword.setValue('Changed123!');

      expect(group.hasError('passwordMismatch')).toBeTrue();
    });
  });

  it('states the rule bilingually, matching the server message', () => {
    expect(PASSWORD_COMPLEXITY_MESSAGE).toContain('密碼長度至少需 8 碼');
    expect(PASSWORD_COMPLEXITY_MESSAGE).toContain('大寫英文／小寫英文／數字／符號');
    expect(PASSWORD_COMPLEXITY_MESSAGE).toContain('at least 3 of the 4 classes');
  });
});
