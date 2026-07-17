import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { PublishStatusService } from '../../../core/services/publish-status.service';
import { PublishStatus, PublishStatusQuery } from '../../../core/models/publish-status.model';

interface ListSort {
  sortField: string;
  sortOrder: number;
}
interface ListPage {
  first: number;
  rows: number;
}

/** Tri-state options for the boolean filters (全部 / 是 / 否). */
const TRISTATE_OPTIONS = [
  { label: '全部', value: null },
  { label: '是', value: true },
  { label: '否', value: false },
];

@Component({
  selector: 'app-publish-status-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DrawerModule,
    InputTextModule,
    SelectModule,
    TagModule,
    TooltipModule,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './publish-status-list.html',
  styleUrl: './publish-status-list.scss',
})
export class PublishStatusList implements OnInit {
  private readonly service = inject(PublishStatusService);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  private static readonly FILTERS_KEY = 'publish-status-list-filters';
  private static readonly SORT_KEY = 'publish-status-list-sort';
  private static readonly PAGE_KEY = 'publish-status-list-page';

  readonly statuses = signal<PublishStatus[]>([]);
  readonly loading = signal(false);
  readonly filterVisible = signal(false);

  readonly tristateOptions = TRISTATE_OPTIONS;

  /** Two-way binding bridge for p-drawer [(visible)]. */
  get filterVisibleModel(): boolean {
    return this.filterVisible();
  }
  set filterVisibleModel(value: boolean) {
    this.filterVisible.set(value);
  }

  filter: PublishStatusQuery = { keyword: null, isDraft: null, isPublished: null, isDiscontinued: null };

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
        this.statuses.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: '載入失敗',
          detail: '無法取得發布狀態資料。',
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
    this.filter = { keyword: null, isDraft: null, isPublished: null, isDiscontinued: null };
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
    this.router.navigate(['/publish-statuses/new']);
  }

  view(status: PublishStatus): void {
    this.router.navigate(['/publish-statuses', status.pkid]);
  }

  edit(status: PublishStatus): void {
    this.router.navigate(['/publish-statuses', status.pkid, 'edit']);
  }

  confirmDelete(status: PublishStatus): void {
    this.confirmationService.confirm({
      header: '確認刪除',
      message: `確定要刪除狀態代碼 <b>${status.pkid}</b>「${status.description}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      rejectButtonStyleClass: 'p-button-text',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.remove(status),
    });
  }

  private remove(status: PublishStatus): void {
    this.service.delete(status.pkid).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: '刪除成功',
          detail: `發布狀態「${status.description}」已刪除。`,
        });
        this.load();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: '刪除失敗',
          detail: '刪除發布狀態時發生錯誤。',
        });
      },
    });
  }

  // ---- session-storage state ----

  private restoreState(): void {
    const filters = this.readJson<PublishStatusQuery>(PublishStatusList.FILTERS_KEY);
    if (filters) this.filter = { ...this.filter, ...filters };

    const sort = this.readJson<ListSort>(PublishStatusList.SORT_KEY);
    if (sort) {
      this.sortField = sort.sortField;
      this.sortOrder = sort.sortOrder;
    }

    const page = this.readJson<ListPage>(PublishStatusList.PAGE_KEY);
    if (page) {
      this.first = page.first;
      this.rows = page.rows;
    }
  }

  private persistFilters(): void {
    sessionStorage.setItem(PublishStatusList.FILTERS_KEY, JSON.stringify(this.filter));
  }

  private persistSort(): void {
    const sort: ListSort = { sortField: this.sortField, sortOrder: this.sortOrder };
    sessionStorage.setItem(PublishStatusList.SORT_KEY, JSON.stringify(sort));
  }

  private persistPage(): void {
    const page: ListPage = { first: this.first, rows: this.rows };
    sessionStorage.setItem(PublishStatusList.PAGE_KEY, JSON.stringify(page));
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
