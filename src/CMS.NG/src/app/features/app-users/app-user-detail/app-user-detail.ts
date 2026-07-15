import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AppUserService } from '../../../core/services/app-user.service';
import { AuthService } from '../../../core/services/auth.service';
import { AppUser, LookupItem } from '../../../core/models/app-user.model';
import { RowAuditBadge } from '../../../core/components/row-audit-badge/row-audit-badge';

@Component({
  selector: 'app-app-user-detail',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    ChipModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    RowAuditBadge,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './app-user-detail.html',
  styleUrl: './app-user-detail.scss',
})
export class AppUserDetail implements OnInit {
  private readonly service = inject(AppUserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly authService = inject(AuthService);

  readonly user = signal<AppUser | null>(null);
  readonly roleLabels = signal<string[]>([]);
  readonly loading = signal(true);

  /** Gates the reset button. The API enforces the Admin role itself — this is convenience only. */
  readonly isAdmin = computed(() => this.authService.hasRole('Admin'));

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id')!;
    forkJoin({
      user: this.service.getById(userId),
      roles: this.service.getAppRoles(),
    }).subscribe({
      next: ({ user, roles }) => {
        this.user.set(user);
        this.roleLabels.set(this.resolveRoleLabels(user.roleIds, roles));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private resolveRoleLabels(roleIds: string[], roles: LookupItem[]): string[] {
    const byId = new Map(roles.map((r) => [r.id, r.label]));
    return roleIds.map((id) => byId.get(id) ?? id);
  }

  confirmResetPassword(): void {
    const user = this.user();
    if (!user) return;
    this.confirmationService.confirm({
      header: '重設密碼',
      message: `確定要將使用者「${user.userId}」的密碼重設為系統預設密碼？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '重設',
      rejectLabel: '取消',
      accept: () => this.resetPassword(user),
    });
  }

  private resetPassword(user: AppUser): void {
    this.service.resetPassword(user.userId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: '重設成功',
          detail: `使用者「${user.userId}」的密碼已重設為預設密碼。`,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: '重設失敗',
          detail: '重設密碼時發生錯誤。',
        });
      },
    });
  }

  edit(): void {
    const user = this.user();
    if (user) this.router.navigate(['/app-users', user.userId, 'edit']);
  }

  back(): void {
    this.router.navigate(['/app-users']);
  }
}
