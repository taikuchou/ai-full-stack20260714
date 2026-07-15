import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Client mirror of the API's PasswordPolicy (CMS.API/Security/PasswordPolicy.cs): at least 8
 * characters and at least 3 of the 4 classes. This is a convenience so the user sees the rule
 * before a round trip — the server re-checks every change and remains the authority.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_REQUIRED_CLASSES = 3;

/** Kept character-for-character identical to PasswordPolicy.ComplexityMessage on the server. */
export const PASSWORD_COMPLEXITY_MESSAGE =
  '密碼長度至少需 8 碼，且內容須至少包含四種字元的其中三種：大寫英文／小寫英文／數字／符號 ' +
  '(Password must be at least 8 characters and contain at least 3 of the 4 classes: ' +
  'uppercase / lowercase / digit / symbol.)';

/**
 * Unicode-aware to track the server's char.IsUpper / IsLower / IsDigit / IsLetterOrDigit rather
 * than an ASCII-only approximation, which would reject accented letters the server accepts.
 */
export function isPasswordCompliant(password: string): boolean {
  if (!password || password.length < PASSWORD_MIN_LENGTH) return false;

  let classes = 0;
  if (/\p{Lu}/u.test(password)) classes++;
  if (/\p{Ll}/u.test(password)) classes++;
  if (/\p{Nd}/u.test(password)) classes++;
  if (/[^\p{L}\p{Nd}]/u.test(password)) classes++;

  return classes >= PASSWORD_REQUIRED_CLASSES;
}

/** Flags `passwordComplexity` on a control whose value fails the rule. */
export const passwordComplexityValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null =>
  !control.value || isPasswordCompliant(control.value) ? null : { passwordComplexity: true };

/**
 * Group validator flagging `passwordMismatch` on the group when new and confirm differ.
 * Group-level rather than per-control so it re-evaluates when either field changes.
 */
export function passwordsMatchValidator(newField: string, confirmField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const next = group.get(newField)?.value;
    const confirm = group.get(confirmField)?.value;
    // Stay quiet until confirm has been typed into — mismatch is not news on an empty field.
    if (!confirm) return null;
    return next === confirm ? null : { passwordMismatch: true };
  };
}
