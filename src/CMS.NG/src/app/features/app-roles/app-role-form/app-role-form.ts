import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { AppRoleService } from '../../../core/services/app-role.service';
import { AppRoleRequest, LookupItem } from '../../../core/models/app-role.model';
import { RowAuditBadge } from '../../../core/components/row-audit-badge/row-audit-badge';

@Component({
  selector: 'app-app-role-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    MultiSelectModule,
    ToastModule,
    RowAuditBadge,
  ],
  providers: [MessageService],
  templateUrl: './app-role-form.html',
  styleUrl: './app-role-form.scss',
})
export class AppRoleForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AppRoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly isEdit = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly users = signal<LookupItem[]>([]);

  private editRoleId: string | null = null;

  /**
   * The audit badge's record — null while adding. The trail is keyed by the numeric pkid column,
   * not RoleId, so this is only known once the role has loaded.
   */
  readonly auditPkid = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    roleId: ['', Validators.required],
    roleName: ['', Validators.required],
    permissionLevel: [100, [Validators.required, Validators.min(0)]],
    description: this.fb.control<string | null>(null),
    userIds: this.fb.nonNullable.control<string[]>([]),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEdit.set(!!id);
    this.editRoleId = id;

    // Parallel lookup + (edit) existing record load.
    forkJoin({
      users: this.service.getAppUsers(),
      role: id ? this.service.getById(id) : of(null),
    }).subscribe({
      next: ({ users, role }) => {
        this.users.set(users);
        if (role) {
          this.auditPkid.set(role.pkid);
          this.form.patchValue({
            roleId: role.roleId,
            roleName: role.roleName,
            permissionLevel: role.permissionLevel,
            description: role.description,
            userIds: role.userIds,
          });
          // RoleId is the primary key — not editable once created.
          this.form.controls.roleId.disable();
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
    const request: AppRoleRequest = {
      roleId: value.roleId,
      roleName: value.roleName,
      permissionLevel: value.permissionLevel,
      description: value.description,
      userIds: value.userIds,
    };

    this.saving.set(true);
    const op$ = this.isEdit() ? this.service.update(request) : this.service.create(request);
    op$.subscribe({
      next: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.isEdit() ? '更新成功' : '新增成功',
          detail: `角色「${request.roleId}」已儲存。`,
        });
        this.router.navigate(['/app-roles', request.roleId]);
      },
      error: (err) => {
        this.saving.set(false);
        const detail =
          err?.status === 409
            ? `角色代碼「${request.roleId}」已存在。`
            : '儲存時發生錯誤。';
        this.messageService.add({ severity: 'error', summary: '儲存失敗', detail });
      },
    });
  }

  cancel(): void {
    if (this.isEdit() && this.editRoleId) {
      this.router.navigate(['/app-roles', this.editRoleId]);
    } else {
      this.router.navigate(['/app-roles']);
    }
  }

  invalid(controlName: keyof typeof this.form.controls): boolean {
    const c = this.form.get(controlName as string);
    return !!c && c.invalid && (c.dirty || c.touched);
  }
}
