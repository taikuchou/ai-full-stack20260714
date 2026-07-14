import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { CourseGroupService } from '../../../core/services/course-group.service';
import { CourseGroupRequest } from '../../../core/models/course-group.model';

@Component({
  selector: 'app-course-group-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule, ToastModule],
  providers: [MessageService],
  templateUrl: './course-group-form.html',
  styleUrl: './course-group-form.scss',
})
export class CourseGroupForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CourseGroupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly isEdit = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);

  // pkid is IDENTITY (DB-assigned) — not a form control. Held separately for the UPDATE key.
  private editPkid = 0;

  readonly form = this.fb.nonNullable.group({
    description: ['', [Validators.required, Validators.maxLength(100)]],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEdit.set(!!id);

    if (id) {
      const pkid = Number(id);
      this.editPkid = pkid;
      this.service.getById(pkid).subscribe({
        next: (courseGroup) => {
          this.form.patchValue({ description: courseGroup.description });
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
    const request: CourseGroupRequest = {
      pkid: this.isEdit() ? this.editPkid : 0,
      description: value.description,
    };

    this.saving.set(true);
    const op$ = this.isEdit() ? this.service.update(request) : this.service.create(request);
    op$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.isEdit() ? '更新成功' : '新增成功',
          detail: `課程群組「${request.description}」已儲存。`,
        });
        // On create the DB-assigned pkid comes back in the response.
        const pkid = this.isEdit() ? this.editPkid : saved.pkid;
        this.router.navigate(['/course-groups', pkid]);
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({ severity: 'error', summary: '儲存失敗', detail: '儲存時發生錯誤。' });
      },
    });
  }

  cancel(): void {
    if (this.isEdit()) {
      this.router.navigate(['/course-groups', this.editPkid]);
    } else {
      this.router.navigate(['/course-groups']);
    }
  }

  invalid(controlName: keyof typeof this.form.controls): boolean {
    const c = this.form.get(controlName as string);
    return !!c && c.invalid && (c.dirty || c.touched);
  }
}
