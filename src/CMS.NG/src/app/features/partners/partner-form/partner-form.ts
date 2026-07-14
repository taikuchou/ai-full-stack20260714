import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { PartnerService } from '../../../core/services/partner.service';
import { PartnerRequest } from '../../../core/models/partner.model';

@Component({
  selector: 'app-partner-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './partner-form.html',
  styleUrl: './partner-form.scss',
})
export class PartnerForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PartnerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly isEdit = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);

  // pkid is IDENTITY (DB-assigned) — not a form control. Held separately for the UPDATE key.
  private editPkid = 0;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(50)]],
    appKey: ['', [Validators.required, Validators.maxLength(10)]],
    nameOnPartnerMenu: ['', [Validators.required, Validators.maxLength(200)]],
    nameOnCourseDetailPage: ['', [Validators.required, Validators.maxLength(50)]],
    displayOrder: [0, [Validators.required, Validators.min(0)]],
    imageFilename: this.fb.control<string | null>(null),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEdit.set(!!id);

    if (id) {
      const pkid = Number(id);
      this.editPkid = pkid;
      this.service.getById(pkid).subscribe({
        next: (partner) => {
          this.form.patchValue({
            name: partner.name,
            appKey: partner.appKey,
            nameOnPartnerMenu: partner.nameOnPartnerMenu,
            nameOnCourseDetailPage: partner.nameOnCourseDetailPage,
            displayOrder: partner.displayOrder,
            imageFilename: partner.imageFilename,
          });
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
    const request: PartnerRequest = {
      pkid: this.isEdit() ? this.editPkid : 0,
      name: value.name,
      appKey: value.appKey,
      nameOnPartnerMenu: value.nameOnPartnerMenu,
      nameOnCourseDetailPage: value.nameOnCourseDetailPage,
      displayOrder: value.displayOrder,
      imageFilename: value.imageFilename,
    };

    this.saving.set(true);
    const op$ = this.isEdit() ? this.service.update(request) : this.service.create(request);
    op$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.isEdit() ? '更新成功' : '新增成功',
          detail: `合作廠商「${request.name}」已儲存。`,
        });
        // On create the DB-assigned pkid comes back in the response.
        const pkid = this.isEdit() ? this.editPkid : saved.pkid;
        this.router.navigate(['/partners', pkid]);
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({ severity: 'error', summary: '儲存失敗', detail: '儲存時發生錯誤。' });
      },
    });
  }

  cancel(): void {
    if (this.isEdit()) {
      this.router.navigate(['/partners', this.editPkid]);
    } else {
      this.router.navigate(['/partners']);
    }
  }

  invalid(controlName: keyof typeof this.form.controls): boolean {
    const c = this.form.get(controlName as string);
    return !!c && c.invalid && (c.dirty || c.touched);
  }
}
