import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  QueryList,
  ViewChildren,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { CourseService } from '../../../core/services/course.service';
import { Course, CourseQuery, CourseRequest, LookupItem } from '../../../core/models/course.model';

interface ListSort {
  sortField: string;
  sortOrder: number;
}
interface ListPage {
  first: number;
  rows: number;
}
interface Option {
  value: number;
  label: string;
}

/** The list columns that inline editing can open. Everything else is display-only. */
export type EditableField =
  | 'displayOrder'
  | 'courseId'
  | 'prodCourseId'
  | 'title'
  | 'publishStatus_pkid'
  | 'scheduleOn'
  | 'scheduleOff'
  | 'hour'
  | 'listPrice'
  | 'learningCredit'
  | 'canRepeat';

/** The one cell currently open for editing. Only ever one at a time. */
interface CellEdit {
  pkid: number;
  field: EditableField;
  /** Working value bound to the editor — a `Date` for date fields, else the raw model value. */
  value: unknown;
  /** The row's value when editing opened, restored if the save fails. */
  original: unknown;
  /** Inline validation message; non-null keeps the cell in edit mode. */
  error: string | null;
}

/** Required free-text cells, with the label and max length used by the messages. */
const TEXT_FIELDS: Record<string, { label: string; max: number }> = {
  title: { label: '課程名稱', max: 200 },
  courseId: { label: '簡介代碼', max: 50 },
  prodCourseId: { label: '科目代碼', max: 50 },
};

/** Cells that must hold a non-negative number. */
const NUMERIC_FIELDS: Record<string, string> = {
  displayOrder: '顯示順序',
  hour: '時數',
  listPrice: '定價',
  learningCredit: '點數',
};

/** Convert a `Date` (from p-datepicker) to a yyyy-MM-dd string using local components. */
function toIso(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a yyyy-MM-dd string into a local `Date` at midnight (avoids UTC shift). */
function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.substring(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

@Component({
  selector: 'app-course-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DrawerModule,
    InputTextModule,
    InputNumberModule,
    CheckboxModule,
    SelectModule,
    DatePickerModule,
    TagModule,
    TooltipModule,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './course-list.html',
  styleUrl: './course-list.scss',
})
export class CourseList implements OnInit {
  private readonly service = inject(CourseService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  private static readonly FILTERS_KEY = 'course-list-filters';
  private static readonly SORT_KEY = 'course-list-sort';
  private static readonly PAGE_KEY = 'course-list-page';

  /**
   * Columns inline editing never opens: the PK, plus the two FK label columns that are
   * resolved server-side by JOIN and have no writable counterpart on the row.
   */
  static readonly READONLY_FIELDS: readonly string[] = ['pkid', 'partnerName', 'courseGroupDescription'];

  readonly courses = signal<Course[]>([]);
  readonly loading = signal(false);
  readonly filterVisible = signal(false);

  readonly partners = signal<Option[]>([]);
  readonly courseGroups = signal<Option[]>([]);
  readonly publishStatuses = signal<Option[]>([]);

  /** The open cell, or null when no cell is being edited. */
  readonly editing = signal<CellEdit | null>(null);
  /** True while an inline save is in flight — blocks opening another cell. */
  readonly savingCell = signal(false);
  /** True while a date editor's overlay is open, so its blur must not commit. */
  private datePanelOpen = false;

  /** The open cell's editor host — only ever one, since only one cell edits at a time. */
  @ViewChildren('cellEditor') private cellEditors!: QueryList<ElementRef<HTMLElement>>;

  /** Tri-state options for the 允許重聽 filter. */
  readonly canRepeatOptions: { value: boolean | null; label: string }[] = [
    { value: null, label: '全部' },
    { value: true, label: '是' },
    { value: false, label: '否' },
  ];

  /** Two-way binding bridge for p-drawer [(visible)]. */
  get filterVisibleModel(): boolean {
    return this.filterVisible();
  }
  set filterVisibleModel(value: boolean) {
    this.filterVisible.set(value);
  }

  filter: CourseQuery = this.emptyFilter();

  // Date-range models bound to p-datepicker (converted to ISO on apply).
  scheduleOnFrom: Date | null = null;
  scheduleOnTo: Date | null = null;
  scheduleOffFrom: Date | null = null;
  scheduleOffTo: Date | null = null;

  sortField = 'displayOrder';
  sortOrder = 1;
  first = 0;
  rows = 20;

  ngOnInit(): void {
    this.restoreState();
    // Load FK filter dropdowns, then the data.
    forkJoin({
      partners: this.service.getPartners(),
      courseGroups: this.service.getCourseGroups(),
      publishStatuses: this.service.getPublishStatuses(),
    }).subscribe({
      next: ({ partners, courseGroups, publishStatuses }) => {
        this.partners.set(this.toOptions(partners));
        this.courseGroups.set(this.toOptions(courseGroups));
        this.publishStatuses.set(this.toOptions(publishStatuses));
      },
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.query(this.filter).subscribe({
      next: (data) => {
        this.courses.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: '載入失敗', detail: '無法取得課程資料。' });
      },
    });
  }

  openFilter(): void {
    this.filterVisible.set(true);
  }

  applyFilter(): void {
    this.filter.scheduleOnFrom = toIso(this.scheduleOnFrom);
    this.filter.scheduleOnTo = toIso(this.scheduleOnTo);
    this.filter.scheduleOffFrom = toIso(this.scheduleOffFrom);
    this.filter.scheduleOffTo = toIso(this.scheduleOffTo);
    this.first = 0;
    this.persistPage();
    this.persistFilters();
    this.filterVisible.set(false);
    this.load();
  }

  resetFilter(): void {
    this.filter = this.emptyFilter();
    this.scheduleOnFrom = this.scheduleOnTo = this.scheduleOffFrom = this.scheduleOffTo = null;
    this.persistFilters();
    this.applyFilter();
  }

  onSort(event: { field?: string | string[]; order?: number }): void {
    if (typeof event.field === 'string') this.sortField = event.field;
    if (event.order != null) this.sortOrder = event.order;
    this.persistSort();
  }

  onPage(event: TableLazyLoadEvent): void {
    this.first = event.first ?? 0;
    this.rows = event.rows ?? this.rows;
    this.persistPage();
  }

  add(): void {
    this.router.navigate(['/courses/new']);
  }

  view(course: Course): void {
    this.router.navigate(['/courses', course.pkid]);
  }

  edit(course: Course): void {
    this.router.navigate(['/courses', course.pkid, 'edit']);
  }

  confirmDelete(course: Course): void {
    this.confirmationService.confirm({
      header: '確認刪除',
      message: `確定要刪除主代碼 <b>${course.pkid}</b>「${course.title}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.remove(course),
    });
  }

  private remove(course: Course): void {
    this.service.delete(course.pkid).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: '刪除成功',
          detail: `課程「${course.title}」已刪除。`,
        });
        this.load();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: '刪除失敗', detail: '刪除課程時發生錯誤。' });
      },
    });
  }

  // ---- inline cell editing ----

  /** False for the PK and the two FK label columns, which stay display-only. */
  canEdit(field: string): boolean {
    return !CourseList.READONLY_FIELDS.includes(field);
  }

  isEditing(course: Course, field: EditableField): boolean {
    const e = this.editing();
    return !!e && e.pkid === course.pkid && e.field === field;
  }

  /** Inline validation message for the open cell, or null. */
  editError(): string | null {
    return this.editing()?.error ?? null;
  }

  /** Working value of the open cell, bound to whichever editor is rendered. */
  get editValue(): unknown {
    return this.editing()?.value ?? null;
  }
  set editValue(value: unknown) {
    const e = this.editing();
    if (e) this.editing.set({ ...e, value });
  }

  /**
   * Open a cell for editing. Bound to (dblclick) — single click must not reach here, so
   * the template deliberately does not use PrimeNG's `pEditableColumn` (it opens on click).
   */
  startEdit(course: Course, field: EditableField): void {
    if (!this.canEdit(field) || this.savingCell()) return;
    if (this.isEditing(course, field)) return;

    const current = course[field] as unknown;
    this.editing.set({
      pkid: course.pkid,
      field,
      value: this.isDateField(field) ? parseDate(current as string) : current,
      original: current,
      error: null,
    });

    // After the editor renders, not during change detection — focusing a PrimeNG control
    // toggles its own focus classes, which would trip NG0100 inside a lifecycle hook.
    afterNextRender(
      () => {
        const host = this.cellEditors?.first?.nativeElement;
        host?.querySelector<HTMLElement>('input, [role="combobox"]')?.focus();
      },
      { injector: this.injector },
    );
  }

  /** Commit the open cell — bound to the editors' blur. */
  commit(course: Course): void {
    const edit = this.editing();
    if (!edit || edit.pkid !== course.pkid) return;

    const error = this.validate(course, edit.field, edit.value);
    if (error) {
      // Keep the cell open so the user can fix the value in place.
      this.editing.set({ ...edit, error });
      return;
    }

    const value = this.normalize(edit.field, edit.value);
    if (value === edit.original) {
      this.editing.set(null);
      return;
    }
    this.persist(course, edit, value);
  }

  /** A date editor's blur only commits once its overlay has closed. */
  commitFromDate(course: Course): void {
    if (this.datePanelOpen) return;
    this.commit(course);
  }

  onDatePanelShow(): void {
    this.datePanelOpen = true;
  }

  onDatePanelHide(): void {
    this.datePanelOpen = false;
  }

  /**
   * Save one edited field through the existing PUT /api/courses.
   *
   * The list row carries only the n-n *counts*, not `certificationPkids` / `jobCategoryPkids`,
   * and the update delete-then-reinserts both link tables — so a request built from the row
   * would silently wipe the course's certifications and job categories. Re-fetch the full
   * course first and override just the edited field.
   */
  private persist(course: Course, edit: CellEdit, value: unknown): void {
    this.savingCell.set(true);
    this.service
      .getById(course.pkid)
      .pipe(switchMap((full) => this.service.update(this.toRequest(full, edit.field, value))))
      .subscribe({
        next: () => {
          this.setRowValue(course, edit.field, value);
          this.savingCell.set(false);
          this.editing.set(null);
          this.messageService.add({
            severity: 'success',
            summary: '更新成功',
            detail: `課程「${course.title}」已儲存。`,
          });
        },
        error: () => {
          this.setRowValue(course, edit.field, edit.original);
          this.savingCell.set(false);
          this.editing.set(null);
          this.messageService.add({ severity: 'error', summary: '儲存失敗', detail: '儲存時發生錯誤，已還原原值。' });
        },
      });
  }

  /** Validate one edited value. Returns the message to show inline, or null when it passes. */
  private validate(course: Course, field: EditableField, value: unknown): string | null {
    const text = TEXT_FIELDS[field];
    if (text) {
      const v = typeof value === 'string' ? value.trim() : '';
      if (!v) return `${text.label}不可為空白。`;
      if (v.length > text.max) return `${text.label}不可超過 ${text.max} 個字元。`;
      return null;
    }

    const numeric = NUMERIC_FIELDS[field];
    if (numeric) {
      if (typeof value !== 'number' || Number.isNaN(value)) return `${numeric}必須為數字。`;
      if (value < 0) return `${numeric}不可為負數。`;
      return null;
    }

    if (field === 'publishStatus_pkid') {
      return value == null ? '上架狀態為必填。' : null;
    }

    if (this.isDateField(field)) {
      const label = field === 'scheduleOn' ? '上架日期' : '下架日期';
      if (!(value instanceof Date) || Number.isNaN(value.getTime())) return `${label}必須是有效日期。`;
      // Compare against the row's other endpoint, which is not being edited.
      if (field === 'scheduleOn') {
        const off = parseDate(course.scheduleOff);
        if (off && value > off) return '上架日期不可晚於下架日期。';
      } else {
        const on = parseDate(course.scheduleOn);
        if (on && value < on) return '下架日期不可早於上架日期。';
      }
      return null;
    }

    return null; // canRepeat — a checkbox is always valid.
  }

  /** Editor value → the row/request representation (dates to ISO, text trimmed). */
  private normalize(field: EditableField, value: unknown): unknown {
    if (this.isDateField(field)) return toIso(value as Date);
    if (TEXT_FIELDS[field]) return (value as string).trim();
    return value;
  }

  private isDateField(field: EditableField): boolean {
    return field === 'scheduleOn' || field === 'scheduleOff';
  }

  /** Write a saved (or reverted) value back onto the row, keeping FK labels in step. */
  private setRowValue(course: Course, field: EditableField, value: unknown): void {
    (course as unknown as Record<string, unknown>)[field] = value;
    if (field === 'publishStatus_pkid') {
      // The label column is JOIN-resolved server-side; mirror it from the lookup we already hold.
      const option = this.publishStatuses().find((o) => o.value === value);
      course.publishStatusDescription = option?.label ?? null;
    }
    this.courses.set([...this.courses()]);
  }

  /** Full write DTO from a freshly fetched course, with the one edited field overridden. */
  private toRequest(full: Course, field: EditableField, value: unknown): CourseRequest {
    const request: CourseRequest = {
      pkid: full.pkid,
      title: full.title,
      officialTitle: full.officialTitle,
      courseId: full.courseId,
      prodCourseId: full.prodCourseId,
      friendlyUrl: full.friendlyUrl,
      displayOrder: full.displayOrder,
      partner_pkid: full.partner_pkid,
      courseGroup_pkid: full.courseGroup_pkid,
      publishStatus_pkid: full.publishStatus_pkid,
      scheduleOn: full.scheduleOn,
      scheduleOff: full.scheduleOff,
      hour: full.hour,
      listPrice: full.listPrice,
      learningCredit: full.learningCredit,
      material: full.material,
      objective: full.objective,
      target: full.target,
      prerequisites: full.prerequisites,
      outline: full.outline,
      towardCertOrExam: full.towardCertOrExam,
      note: full.note,
      otherInfo: full.otherInfo,
      canRepeat: full.canRepeat,
      certificationPkids: full.certificationPkids ?? [],
      jobCategoryPkids: full.jobCategoryPkids ?? [],
    };
    return { ...request, [field]: value } as CourseRequest;
  }

  private toOptions(items: LookupItem[]): Option[] {
    return items.map((i) => ({ value: Number(i.id), label: i.label }));
  }

  private emptyFilter(): CourseQuery {
    return {
      keyword: null,
      partnerPkid: null,
      courseGroupPkid: null,
      publishStatusPkid: null,
      canRepeat: null,
      scheduleOnFrom: null,
      scheduleOnTo: null,
      scheduleOffFrom: null,
      scheduleOffTo: null,
    };
  }

  // ---- session-storage state ----

  private restoreState(): void {
    const filters = this.readJson<CourseQuery>(CourseList.FILTERS_KEY);
    if (filters) {
      this.filter = { ...this.filter, ...filters };
      this.scheduleOnFrom = parseDate(filters.scheduleOnFrom);
      this.scheduleOnTo = parseDate(filters.scheduleOnTo);
      this.scheduleOffFrom = parseDate(filters.scheduleOffFrom);
      this.scheduleOffTo = parseDate(filters.scheduleOffTo);
    }

    const sort = this.readJson<ListSort>(CourseList.SORT_KEY);
    if (sort) {
      this.sortField = sort.sortField;
      this.sortOrder = sort.sortOrder;
    }

    const page = this.readJson<ListPage>(CourseList.PAGE_KEY);
    if (page) {
      this.first = page.first;
      this.rows = page.rows;
    }
  }

  private persistFilters(): void {
    sessionStorage.setItem(CourseList.FILTERS_KEY, JSON.stringify(this.filter));
  }

  private persistSort(): void {
    const sort: ListSort = { sortField: this.sortField, sortOrder: this.sortOrder };
    sessionStorage.setItem(CourseList.SORT_KEY, JSON.stringify(sort));
  }

  private persistPage(): void {
    const page: ListPage = { first: this.first, rows: this.rows };
    sessionStorage.setItem(CourseList.PAGE_KEY, JSON.stringify(page));
  }

  private readJson<T>(key: string): T | null {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
