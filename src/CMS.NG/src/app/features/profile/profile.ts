import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { AuthService } from '../../core/services/auth.service';
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  passwordComplexityValidator,
  passwordsMatchValidator,
} from '../../core/utils/password-policy';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    TagModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly messageService = inject(MessageService);

  readonly submitting = signal(false);

  // UserId and roles are read straight off the stored profile for display. Neither is editable, and
  // neither is sent on save — the API derives both from the token regardless of what we post.
  readonly userId = computed(() => this.authService.profile()?.userId ?? '');
  readonly roles = computed(() => this.authService.profile()?.roles ?? []);

  readonly form = this.fb.nonNullable.group({
    userName: [this.authService.profile()?.userName ?? '', [requiredNonBlank]],
  });

  // ---- Change password ----

  readonly complexityMessage = PASSWORD_COMPLEXITY_MESSAGE;
  readonly changingPassword = signal(false);

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, passwordComplexityValidator]],
      confirmNewPassword: ['', [Validators.required]],
    },
    { validators: [passwordsMatchValidator('newPassword', 'confirmNewPassword')] },
  );

  /** True once a password control has been touched and is missing a required value. */
  invalidPassword(controlName: keyof typeof this.passwordForm.controls): boolean {
    const c = this.passwordForm.controls[controlName];
    return c.hasError('required') && (c.dirty || c.touched);
  }

  /** True once the new-password field has been touched and fails the complexity rule. */
  complexityFailed(): boolean {
    const c = this.passwordForm.controls.newPassword;
    return c.hasError('passwordComplexity') && (c.dirty || c.touched);
  }

  /** True once confirm has been touched and differs from the new password. */
  mismatch(): boolean {
    const c = this.passwordForm.controls.confirmNewPassword;
    return this.passwordForm.hasError('passwordMismatch') && (c.dirty || c.touched);
  }

  submitPassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.changingPassword.set(true);
    this.authService.changePassword(this.passwordForm.getRawValue()).subscribe({
      next: () => {
        this.changingPassword.set(false);
        // Never leave plaintext sitting in the DOM after a successful change.
        this.passwordForm.reset();
        this.messageService.add({
          severity: 'success',
          summary: '已變更',
          detail: '密碼已變更。',
        });
      },
      error: (err: HttpErrorResponse) => {
        this.changingPassword.set(false);
        // The server is the authority on why this failed (wrong current password, complexity);
        // surface its message rather than guessing at one.
        this.messageService.add({
          severity: 'error',
          summary: '變更失敗',
          detail: err.error?.message ?? '密碼變更失敗，請稍後再試。',
        });
      },
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const userName = this.form.getRawValue().userName.trim();
    this.submitting.set(true);
    this.authService.updateUserName(userName).subscribe({
      next: (profile) => {
        this.submitting.set(false);
        // Re-seed the control with the server's stored value, so a trimmed name shows as saved.
        this.form.controls.userName.setValue(profile.userName);
        this.form.markAsPristine();
        this.messageService.add({
          severity: 'success',
          summary: '已儲存',
          detail: '個人資料已更新。',
        });
      },
      error: () => {
        this.submitting.set(false);
        this.messageService.add({
          severity: 'error',
          summary: '儲存失敗',
          detail: '個人資料更新失敗，請稍後再試。',
        });
      },
    });
  }

  invalid(controlName: keyof typeof this.form.controls): boolean {
    const c = this.form.get(controlName as string);
    return !!c && c.invalid && (c.dirty || c.touched);
  }
}

/** Required, but whitespace-only is empty too — Validators.required alone accepts '   '. */
const requiredNonBlank: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  (control.value ?? '').trim().length ? null : { required: true };
