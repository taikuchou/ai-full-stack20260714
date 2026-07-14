import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { CourseGroupService } from '../../../core/services/course-group.service';
import { CourseGroup, CourseGroupQuery } from '../../../core/models/course-group.model';

interface ListSort {
  sortField: string;
  sortOrder: number;
}
interface ListPage {
  first: number;
  rows: number;
}

@Component({
  selector: 'app-course-group-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DrawerModule,
    InputTextModule,
    TooltipModule,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './course-group-list.html',
  styleUrl: './course-group-list.scss',
})
export class CourseGroupList implements OnInit {
  private readonly service = inject(CourseGroupService);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  private static readonly FILTERS_KEY = 'course-group-list-filters';
  private static readonly SORT_KEY = 'course-group-list-sort';
  private static readonly PAGE_KEY = 'course-group-list-page';

  readonly courseGroups = signal<CourseGroup[]>([]);
  readonly loading = signal(false);
  readonly filterVisible = signal(false);

  /** Two-way binding bridge for p-drawer [(visible)]. */
  get filterVisibleModel(): boolean {
    return this.filterVisible();
  }
  set filterVisibleModel(value: boolean) {
    this.filterVisible.set(value);
  }

  filter: CourseGroupQuery = { keyword: null };

  sortField = 'pkid';
  sortOrder = 1;
  first = 0;
  rows = 20;

  ngOnInit(): void {
    this.restoreState();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.query(this.filter).subscribe({
      next: (data) => {
        this.courseGroups.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: '載入失敗',
          detail: '無法取得課程群組資料。',
        });
      },
    });
  }

  openFilter(): void {
    this.filterVisible.set(true);
  }

  applyFilter(): void {
    this.first = 0;
    this.persistPage();
    this.persistFilters();
    this.filterVisible.set(false);
    this.load();
  }

  resetFilter(): void {
    this.filter = { keyword: null };
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
    this.router.navigate(['/course-groups/new']);
  }

  view(courseGroup: CourseGroup): void {
    this.router.navigate(['/course-groups', courseGroup.pkid]);
  }

  edit(courseGroup: CourseGroup): void {
    this.router.navigate(['/course-groups', courseGroup.pkid, 'edit']);
  }

  confirmDelete(courseGroup: CourseGroup): void {
    this.confirmationService.confirm({
      header: '確認刪除',
      message: `確定要刪除主代碼 <b>${courseGroup.pkid}</b>「${courseGroup.description}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.remove(courseGroup),
    });
  }

  private remove(courseGroup: CourseGroup): void {
    this.service.delete(courseGroup.pkid).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: '刪除成功',
          detail: `課程群組「${courseGroup.description}」已刪除。`,
        });
        this.load();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: '刪除失敗',
          detail: '刪除課程群組時發生錯誤。',
        });
      },
    });
  }

  // ---- session-storage state ----

  private restoreState(): void {
    const filters = this.readJson<CourseGroupQuery>(CourseGroupList.FILTERS_KEY);
    if (filters) this.filter = { ...this.filter, ...filters };

    const sort = this.readJson<ListSort>(CourseGroupList.SORT_KEY);
    if (sort) {
      this.sortField = sort.sortField;
      this.sortOrder = sort.sortOrder;
    }

    const page = this.readJson<ListPage>(CourseGroupList.PAGE_KEY);
    if (page) {
      this.first = page.first;
      this.rows = page.rows;
    }
  }

  private persistFilters(): void {
    sessionStorage.setItem(CourseGroupList.FILTERS_KEY, JSON.stringify(this.filter));
  }

  private persistSort(): void {
    const sort: ListSort = { sortField: this.sortField, sortOrder: this.sortOrder };
    sessionStorage.setItem(CourseGroupList.SORT_KEY, JSON.stringify(sort));
  }

  private persistPage(): void {
    const page: ListPage = { first: this.first, rows: this.rows };
    sessionStorage.setItem(CourseGroupList.PAGE_KEY, JSON.stringify(page));
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
