import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { CourseService } from '../../../core/services/course.service';
import { CourseRequest, LookupItem } from '../../../core/models/course.model';

interface Option {
  value: number;
  label: string;
}

/** Convert a `Date` (from p-datepicker) to a yyyy-MM-dd string using local components. */
function toIso(d: Date | null): string {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a yyyy-MM-dd string into a local `Date` at midnight (avoids UTC shift). */
function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.substring(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

@Component({
  selector: 'app-course-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    SelectModule,
    MultiSelectModule,
    DatePickerModule,
    ToggleSwitchModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './course-form.html',
  styleUrl: './course-form.scss',
})
export class CourseForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CourseService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly isEdit = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly partners = signal<Option[]>([]);
  readonly courseGroups = signal<Option[]>([]);
  readonly publishStatuses = signal<Option[]>([]);
  readonly certifications = signal<Option[]>([]);
  readonly jobCategories = signal<Option[]>([]);

  // pkid is IDENTITY (DB-assigned) — not a form control. Held separately for the UPDATE key.
  private editPkid = 0;

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    officialTitle: this.fb.control<string | null>(null),
    courseId: ['', [Validators.required, Validators.maxLength(50)]],
    prodCourseId: ['', [Validators.required, Validators.maxLength(50)]],
    friendlyUrl: ['', [Validators.required, Validators.maxLength(100)]],
    displayOrder: [0, [Validators.required, Validators.min(0)]],
    partner_pkid: this.fb.control<number | null>(null, Validators.required),
    courseGroup_pkid: this.fb.control<number | null>(null),
    publishStatus_pkid: this.fb.control<number | null>(null, Validators.required),
    scheduleOn: this.fb.control<Date | null>(null, Validators.required),
    scheduleOff: this.fb.control<Date | null>(null, Validators.required),
    hour: [0, [Validators.required, Validators.min(0)]],
    listPrice: [0, [Validators.required, Validators.min(0)]],
    learningCredit: [0, [Validators.required, Validators.min(0)]],
    material: this.fb.control<string | null>(null),
    objective: this.fb.control<string | null>(null),
    target: this.fb.control<string | null>(null),
    prerequisites: this.fb.control<string | null>(null),
    outline: this.fb.control<string | null>(null),
    towardCertOrExam: this.fb.control<string | null>(null),
    note: this.fb.control<string | null>(null),
    otherInfo: this.fb.control<string | null>(null),
    canRepeat: [false],
    certificationPkids: this.fb.nonNullable.control<number[]>([]),
    jobCategoryPkids: this.fb.nonNullable.control<number[]>([]),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEdit.set(!!id);

    forkJoin({
      partners: this.service.getPartners(),
      courseGroups: this.service.getCourseGroups(),
      publishStatuses: this.service.getPublishStatuses(),
      certifications: this.service.getCertifications(),
      jobCategories: this.service.getJobCategories(),
      course: id ? this.service.getById(Number(id)) : of(null),
    }).subscribe({
      next: ({ partners, courseGroups, publishStatuses, certifications, jobCategories, course }) => {
        this.partners.set(this.toOptions(partners));
        this.courseGroups.set(this.toOptions(courseGroups));
        this.publishStatuses.set(this.toOptions(publishStatuses));
        this.certifications.set(this.toOptions(certifications));
        this.jobCategories.set(this.toOptions(jobCategories));

        if (course) {
          this.editPkid = course.pkid;
          this.form.patchValue({
            title: course.title,
            officialTitle: course.officialTitle,
            courseId: course.courseId,
            prodCourseId: course.prodCourseId,
            friendlyUrl: course.friendlyUrl,
            displayOrder: course.displayOrder,
            partner_pkid: course.partner_pkid,
            courseGroup_pkid: course.courseGroup_pkid,
            publishStatus_pkid: course.publishStatus_pkid,
            scheduleOn: parseDate(course.scheduleOn),
            scheduleOff: parseDate(course.scheduleOff),
            hour: course.hour,
            listPrice: course.listPrice,
            learningCredit: course.learningCredit,
            material: course.material,
            objective: course.objective,
            target: course.target,
            prerequisites: course.prerequisites,
            outline: course.outline,
            towardCertOrExam: course.towardCertOrExam,
            note: course.note,
            otherInfo: course.otherInfo,
            canRepeat: course.canRepeat,
            certificationPkids: course.certificationPkids,
            jobCategoryPkids: course.jobCategoryPkids,
          });
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: '載入失敗', detail: '無法取得資料。' });
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: CourseRequest = {
      pkid: this.isEdit() ? this.editPkid : 0,
      title: value.title,
      officialTitle: value.officialTitle,
      courseId: value.courseId,
      prodCourseId: value.prodCourseId,
      friendlyUrl: value.friendlyUrl,
      displayOrder: value.displayOrder,
      partner_pkid: value.partner_pkid!,
      courseGroup_pkid: value.courseGroup_pkid,
      publishStatus_pkid: value.publishStatus_pkid!,
      scheduleOn: toIso(value.scheduleOn),
      scheduleOff: toIso(value.scheduleOff),
      hour: value.hour,
      listPrice: value.listPrice,
      learningCredit: value.learningCredit,
      material: value.material,
      objective: value.objective,
      target: value.target,
      prerequisites: value.prerequisites,
      outline: value.outline,
      towardCertOrExam: value.towardCertOrExam,
      note: value.note,
      otherInfo: value.otherInfo,
      canRepeat: value.canRepeat,
      certificationPkids: value.certificationPkids,
      jobCategoryPkids: value.jobCategoryPkids,
    };

    this.saving.set(true);
    const op$ = this.isEdit() ? this.service.update(request) : this.service.create(request);
    op$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.isEdit() ? '更新成功' : '新增成功',
          detail: `課程「${request.title}」已儲存。`,
        });
        const pkid = this.isEdit() ? this.editPkid : saved.pkid;
        this.router.navigate(['/courses', pkid]);
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({ severity: 'error', summary: '儲存失敗', detail: '儲存時發生錯誤。' });
      },
    });
  }

  cancel(): void {
    if (this.isEdit()) {
      this.router.navigate(['/courses', this.editPkid]);
    } else {
      this.router.navigate(['/courses']);
    }
  }

  invalid(controlName: keyof typeof this.form.controls): boolean {
    const c = this.form.get(controlName as string);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  private toOptions(items: LookupItem[]): Option[] {
    return items.map((i) => ({ value: Number(i.id), label: i.label }));
  }
}
