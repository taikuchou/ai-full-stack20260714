import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

import { AppUserService } from '../../../core/services/app-user.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppUserRequest, LookupItem } from '../../../core/models/app-user.model';
import { RowAuditBadge } from '../../../core/components/row-audit-badge/row-audit-badge';

@Component({
  selector: 'app-app-user-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    ToggleSwitchModule,
    MultiSelectModule,
    ToastModule,
    ConfirmDialogModule,
    RowAuditBadge,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './app-user-form.html',
  styleUrl: './app-user-form.scss',
})
export class AppUserForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AppUserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly authService = inject(AuthService);

  readonly isEdit = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly resetting = signal(false);
  readonly roles = signal<LookupItem[]>([]);

  /**
   * Gates the reset button. Convenience only — the API enforces the Admin role itself, so hiding
   * this is not what makes the action safe.
   */
  readonly isAdmin = computed(() => this.authService.hasRole('Admin'));

  private editUserId: string | null = null;

  /**
   * The audit badge's record — null while adding. The trail is keyed by the numeric pkid column,
   * not UserId, so this is only known once the user has loaded.
   */
  readonly auditPkid = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    userId: ['', Validators.required],
    userName: ['', Validators.required],
    isActive: [true],
    roleIds: this.fb.nonNullable.control<string[]>([]),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEdit.set(!!id);
    this.editUserId = id;

    // Parallel lookup + (edit) existing record load.
    forkJoin({
      roles: this.service.getAppRoles(),
      user: id ? this.service.getById(id) : of(null),
    }).subscribe({
      next: ({ roles, user }) => {
        this.roles.set(roles);
        if (user) {
          this.auditPkid.set(user.pkid);
          this.form.patchValue({
            userId: user.userId,
            userName: user.userName,
            isActive: user.isActive,
            roleIds: user.roleIds,
          });
          // UserId is the primary key — not editable once created.
          this.form.controls.userId.disable();
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: '載入失敗',
          detail: '無法取得資料。',
        });
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: AppUserRequest = {
      userId: value.userId,
      userName: value.userName,
      isActive: value.isActive,
      roleIds: value.roleIds,
    };

    this.saving.set(true);
    const op$ = this.isEdit() ? this.service.update(request) : this.service.create(request);
    op$.subscribe({
      next: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.isEdit() ? '更新成功' : '新增成功',
          detail: `使用者「${request.userId}」已儲存。`,
        });
        this.router.navigate(['/app-users', request.userId]);
      },
      error: (err) => {
        this.saving.set(false);
        const detail =
          err?.status === 409
            ? `使用者代碼「${request.userId}」已存在。`
            : '儲存時發生錯誤。';
        this.messageService.add({ severity: 'error', summary: '儲存失敗', detail });
      },
    });
  }

  confirmResetPassword(): void {
    const userId = this.editUserId;
    if (!userId) return;

    this.confirmationService.confirm({
      header: '重設密碼',
      message: `確定要將使用者「${userId}」的密碼重設為系統預設密碼？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '重設',
      rejectLabel: '取消',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => this.resetPassword(userId),
    });
  }

  private resetPassword(userId: string): void {
    // Only the UserId goes out; the default password is read server-side from SysConfig and no
    // password or hash comes back.
    this.resetting.set(true);
    this.service.resetPassword(userId).subscribe({
      next: () => {
        this.resetting.set(false);
        this.messageService.add({
          severity: 'success',
          summary: '重設成功',
          detail: `使用者「${userId}」的密碼已重設為預設密碼。`,
        });
      },
      error: (err) => {
        this.resetting.set(false);
        this.messageService.add({
          severity: 'error',
          summary: '重設失敗',
          // 403 means the API refused the role — reachable if the token's roles changed since load.
          detail: err?.status === 403 ? '需要 Admin 權限才能重設密碼。' : '重設密碼時發生錯誤。',
        });
      },
    });
  }

  cancel(): void {
    if (this.isEdit() && this.editUserId) {
      this.router.navigate(['/app-users', this.editUserId]);
    } else {
      this.router.navigate(['/app-users']);
    }
  }

  invalid(controlName: keyof typeof this.form.controls): boolean {
    const c = this.form.get(controlName as string);
    return !!c && c.invalid && (c.dirty || c.touched);
  }
}
