import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { CourseService } from '../../../core/services/course.service';
import { Course, CourseQuery, LookupItem } from '../../../core/models/course.model';

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

/** Convert a `Date` (from p-datepicker) to a yyyy-MM-dd string using local components. */
function toIso(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  private static readonly FILTERS_KEY = 'course-list-filters';
  private static readonly SORT_KEY = 'course-list-sort';
  private static readonly PAGE_KEY = 'course-list-page';

  readonly courses = signal<Course[]>([]);
  readonly loading = signal(false);
  readonly filterVisible = signal(false);

  readonly partners = signal<Option[]>([]);
  readonly courseGroups = signal<Option[]>([]);
  readonly publishStatuses = signal<Option[]>([]);

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
      this.scheduleOnFrom = this.parseDate(filters.scheduleOnFrom);
      this.scheduleOnTo = this.parseDate(filters.scheduleOnTo);
      this.scheduleOffFrom = this.parseDate(filters.scheduleOffFrom);
      this.scheduleOffTo = this.parseDate(filters.scheduleOffTo);
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

  private parseDate(s: string | null | undefined): Date | null {
    if (!s) return null;
    const [y, m, d] = s.substring(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
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
