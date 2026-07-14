import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { PublishStatusService } from '../../../core/services/publish-status.service';
import { PublishStatusRequest } from '../../../core/models/publish-status.model';

@Component({
  selector: 'app-publish-status-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    ToggleSwitchModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './publish-status-form.html',
  styleUrl: './publish-status-form.scss',
})
export class PublishStatusForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PublishStatusService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly isEdit = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);

  private editPkid: number | null = null;

  readonly form = this.fb.nonNullable.group({
    pkid: [0, [Validators.required, Validators.min(0), Validators.max(255)]],
    description: ['', [Validators.required, Validators.maxLength(50)]],
    isDraft: [false],
    isPublished: [false],
    isDiscontinued: [false],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEdit.set(!!id);

    if (id) {
      const pkid = Number(id);
      this.editPkid = pkid;
      this.service.getById(pkid).subscribe({
        next: (status) => {
          this.form.patchValue({
            pkid: status.pkid,
            description: status.description,
            isDraft: status.isDraft,
            isPublished: status.isPublished,
            isDiscontinued: status.isDiscontinued,
          });
          // pkid is the user-assigned primary key — not editable once created.
          this.form.controls.pkid.disable();
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
    } else {
      this.loading.set(false);
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: PublishStatusRequest = {
      pkid: value.pkid,
      description: value.description,
      isDraft: value.isDraft,
      isPublished: value.isPublished,
      isDiscontinued: value.isDiscontinued,
    };

    this.saving.set(true);
    const op$ = this.isEdit() ? this.service.update(request) : this.service.create(request);
    op$.subscribe({
      next: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.isEdit() ? '更新成功' : '新增成功',
          detail: `發布狀態「${request.description}」已儲存。`,
        });
        this.router.navigate(['/publish-statuses', request.pkid]);
      },
      error: (err) => {
        this.saving.set(false);
        const detail =
          err?.status === 409
            ? `狀態代碼「${request.pkid}」已存在。`
            : '儲存時發生錯誤。';
        this.messageService.add({ severity: 'error', summary: '儲存失敗', detail });
      },
    });
  }

  cancel(): void {
    if (this.isEdit() && this.editPkid != null) {
      this.router.navigate(['/publish-statuses', this.editPkid]);
    } else {
      this.router.navigate(['/publish-statuses']);
    }
  }

  invalid(controlName: keyof typeof this.form.controls): boolean {
    const c = this.form.get(controlName as string);
    return !!c && c.invalid && (c.dirty || c.touched);
  }
}
