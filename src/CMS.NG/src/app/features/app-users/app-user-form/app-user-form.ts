import { Component, OnInit, inject, signal } from '@angular/core';
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

import { AppUserService } from '../../../core/services/app-user.service';
import { AppUserRequest, LookupItem } from '../../../core/models/app-user.model';

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
  ],
  providers: [MessageService],
  templateUrl: './app-user-form.html',
  styleUrl: './app-user-form.scss',
})
export class AppUserForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AppUserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly isEdit = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly roles = signal<LookupItem[]>([]);

  private editUserId: string | null = null;

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
