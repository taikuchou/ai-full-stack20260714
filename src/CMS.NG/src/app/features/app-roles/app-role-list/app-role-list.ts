import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { AppRoleService } from '../../../core/services/app-role.service';
import { AppRole, AppRoleQuery } from '../../../core/models/app-role.model';

interface ListSort {
  sortField: string;
  sortOrder: number;
}
interface ListPage {
  first: number;
  rows: number;
}

@Component({
  selector: 'app-app-role-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DrawerModule,
    InputTextModule,
    InputNumberModule,
    TooltipModule,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './app-role-list.html',
  styleUrl: './app-role-list.scss',
})
export class AppRoleList implements OnInit {
  private readonly service = inject(AppRoleService);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  private static readonly FILTERS_KEY = 'app-role-list-filters';
  private static readonly SORT_KEY = 'app-role-list-sort';
  private static readonly PAGE_KEY = 'app-role-list-page';

  readonly roles = signal<AppRole[]>([]);
  readonly loading = signal(false);
  readonly filterVisible = signal(false);

  /** Two-way binding bridge for p-drawer [(visible)]. */
  get filterVisibleModel(): boolean {
    return this.filterVisible();
  }
  set filterVisibleModel(value: boolean) {
    this.filterVisible.set(value);
  }

  filter: AppRoleQuery = { keyword: null, permissionLevelFrom: null, permissionLevelTo: null };

  sortField = 'roleId';
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
        this.roles.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: '載入失敗',
          detail: '無法取得角色資料。',
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
    this.filter = { keyword: null, permissionLevelFrom: null, permissionLevelTo: null };
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
    this.router.navigate(['/app-roles/new']);
  }

  view(role: AppRole): void {
    this.router.navigate(['/app-roles', role.roleId]);
  }

  edit(role: AppRole): void {
    this.router.navigate(['/app-roles', role.roleId, 'edit']);
  }

  confirmDelete(role: AppRole): void {
    this.confirmationService.confirm({
      header: '確認刪除',
      message: `確定要刪除主代碼 <b>${role.pkid}</b>「${role.roleId}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      rejectButtonStyleClass: 'p-button-text',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.remove(role),
    });
  }

  private remove(role: AppRole): void {
    this.service.delete(role.roleId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: '刪除成功',
          detail: `角色「${role.roleId}」已刪除。`,
        });
        this.load();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: '刪除失敗',
          detail: '刪除角色時發生錯誤。',
        });
      },
    });
  }

  // ---- session-storage state ----

  private restoreState(): void {
    const filters = this.readJson<AppRoleQuery>(AppRoleList.FILTERS_KEY);
    if (filters) this.filter = { ...this.filter, ...filters };

    const sort = this.readJson<ListSort>(AppRoleList.SORT_KEY);
    if (sort) {
      this.sortField = sort.sortField;
      this.sortOrder = sort.sortOrder;
    }

    const page = this.readJson<ListPage>(AppRoleList.PAGE_KEY);
    if (page) {
      this.first = page.first;
      this.rows = page.rows;
    }
  }

  private persistFilters(): void {
    sessionStorage.setItem(AppRoleList.FILTERS_KEY, JSON.stringify(this.filter));
  }

  private persistSort(): void {
    const sort: ListSort = { sortField: this.sortField, sortOrder: this.sortOrder };
    sessionStorage.setItem(AppRoleList.SORT_KEY, JSON.stringify(sort));
  }

  private persistPage(): void {
    const page: ListPage = { first: this.first, rows: this.rows };
    sessionStorage.setItem(AppRoleList.PAGE_KEY, JSON.stringify(page));
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
