import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

import { RowAuditService } from '../../services/row-audit.service';
import { RowAuditHistoryItem } from '../../models/row-audit.model';

/**
 * Parses the API's offset-less UTC timestamp (`2026-06-04T06:30:00`).
 *
 * `new Date(value)` reads an offset-less string as **local** time, which would render every audit
 * entry 8 hours early for a UTC+8 reader. Marking it UTC first is what makes the local formatting
 * below correct.
 */
export function parseUtc(value: string): Date {
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}

/** 'YYYY-MM-DD HH:mm' in the viewer's local time, built from local components (never toISOString). */
export function formatAuditTime(value: string): string {
  const date = parseUtc(value);
  if (Number.isNaN(date.getTime())) return value;

  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Reusable audit-trail badge (異動紀錄 History) for a single record.
 *
 * Shows the most recent change inline so it is readable without clicking, and opens the full trail
 * in a dialog. Drop it into a page header's `.page-title`:
 *
 * ```html
 * <app-row-audit-badge tableName="Partner" [pkid]="partner().pkid" />
 * ```
 */
@Component({
  selector: 'app-row-audit-badge',
  standalone: true,
  imports: [CommonModule, ButtonModule, DialogModule],
  templateUrl: './row-audit-badge.html',
  styleUrl: './row-audit-badge.scss',
})
export class RowAuditBadge {
  private readonly service = inject(RowAuditService);

  /** The DB table this record lives in, e.g. 'Course'. */
  readonly tableName = input.required<string>();

  /**
   * The record's pkid. Pass `null` for a new, unsaved record — the badge then shows its neutral
   * empty state and queries nothing.
   *
   * On the string-PK tables (AppRole, AppUser) pass the numeric `pkid`, not RoleId/UserId: the
   * writer stores the entity's `pkid` property in PrimaryKeyValues.
   */
  readonly pkid = input<number | string | null | undefined>(null);

  readonly history = signal<RowAuditHistoryItem[]>([]);
  readonly loading = signal(false);
  readonly dialogVisible = signal(false);

  /** False for a record that does not exist yet, so there is nothing to fetch. */
  readonly hasRecord = computed(() => {
    const pkid = this.pkid();
    return pkid !== null && pkid !== undefined && String(pkid).trim() !== '';
  });

  /** The most recent change — the trail is newest-first, so it is simply the head. */
  readonly latest = computed<RowAuditHistoryItem | null>(() => this.history()[0] ?? null);

  /** e.g. 'Update by alice · 2026-06-04 14:30'. Null when the record has no history. */
  readonly latestLabel = computed(() => {
    const latest = this.latest();
    return latest
      ? `${latest.actionType} by ${latest.userName} · ${formatAuditTime(latest.dateTime)}`
      : null;
  });

  constructor() {
    // Re-fetches if the host swaps the record (e.g. a form that saves and stays put).
    effect(() => {
      const tableName = this.tableName();
      const pkid = this.pkid();

      if (!this.hasRecord()) {
        this.history.set([]);
        return;
      }

      this.load(tableName, pkid!);
    });
  }

  /** Two-way binding bridge for p-dialog [(visible)]. */
  get dialogVisibleModel(): boolean {
    return this.dialogVisible();
  }
  set dialogVisibleModel(value: boolean) {
    this.dialogVisible.set(value);
  }

  format(value: string): string {
    return formatAuditTime(value);
  }

  open(): void {
    this.dialogVisible.set(true);
  }

  private load(tableName: string, pkid: number | string): void {
    this.loading.set(true);
    this.service.getForRecord(tableName, pkid).subscribe({
      next: (history) => {
        this.history.set(history);
        this.loading.set(false);
      },
      // A failed trail must not break the page it decorates: fall back to the empty state.
      error: () => {
        this.history.set([]);
        this.loading.set(false);
      },
    });
  }
}
