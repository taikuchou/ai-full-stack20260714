import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsModule } from 'primeng/tabs';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';

import { FeaturedPromoItemService } from '../../../core/services/featured-promo-item.service';
import {
  FeaturedPromoItem,
  LookupItem,
} from '../../../core/models/featured-promo-item.model';
import {
  FeaturedPromoItemForm,
  PromoSeed,
} from '../featured-promo-item-form/featured-promo-item-form';

interface Option {
  value: number;
  label: string;
}

/** One column of the grid: a date plus its display label. */
interface Day {
  iso: string;
  label: string;
}

/** Which cell has the inline form open, and what it opens with. */
interface EditTarget {
  scheduleOn: string;
  slot: number;
  /** null = New (empty or pasted); non-null = Edit. */
  item: FeaturedPromoItem | null;
  seed: PromoSeed | null;
}

/** Persisted grid position — which tab and which week the user last looked at. */
interface ListFilters {
  trainingCenterPkid: number | null;
  weekStart: string;
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

/** Convert a `Date` to a yyyy-MM-dd string using local components. */
function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a yyyy-MM-dd string into a local `Date` (never `new Date(s)` — that parses as UTC). */
function parseDate(s: string): Date {
  const [y, m, d] = s.substring(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The Monday of the week containing `d`. Mirrors Week.MondayOf on the API. */
function mondayOf(d: Date): Date {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay() numbers Sunday as 0; shift so Monday = 0 … Sunday = 6.
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return monday;
}

/**
 * Weekly schedule grid (上稿作業): a TrainingCenter tab strip over a Monday–Sunday week, each day
 * holding three slots. Cells hold a promo or stand empty; the inline form opens in place.
 */
@Component({
  selector: 'app-featured-promo-item-list',
  standalone: true,
  imports: [
    CommonModule,
    TabsModule,
    ButtonModule,
    ToastModule,
    ConfirmDialogModule,
    FeaturedPromoItemForm,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './featured-promo-item-list.html',
  styleUrl: './featured-promo-item-list.scss',
})
export class FeaturedPromoItemList implements OnInit {
  private readonly service = inject(FeaturedPromoItemService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  private static readonly FILTERS_KEY = 'featured-promo-item-list-filters';
  private static readonly CLIPBOARD_KEY = 'featured-promo-item-clipboard';

  /** Slots rendered per day. Mirrors FeaturedPromoItem.MinSlot–MaxSlot on the API. */
  readonly slots = [1, 2, 3];

  readonly items = signal<FeaturedPromoItem[]>([]);
  readonly trainingCenters = signal<Option[]>([]);
  readonly activeCenterPkid = signal<number | null>(null);
  readonly weekStart = signal<Date>(mondayOf(new Date()));
  readonly loading = signal(false);
  readonly editing = signal<EditTarget | null>(null);
  readonly clipboard = signal<PromoSeed | null>(null);

  /** The seven day columns of the week in view. */
  readonly days = computed<Day[]>(() => {
    const start = this.weekStart();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return {
        iso: toIso(d),
        label: `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAY_LABELS[i]})`,
      };
    });
  });

  /** The `3/16 -- 3/22` header between the week arrows. */
  readonly weekLabel = computed(() => {
    const days = this.days();
    const first = parseDate(days[0].iso);
    const last = parseDate(days[6].iso);
    return `${first.getMonth() + 1}/${first.getDate()} -- ${last.getMonth() + 1}/${last.getDate()}`;
  });

  ngOnInit(): void {
    this.restoreState();

    // The grid is always scoped to one centre, so the tabs have to resolve before the first load.
    this.service.getTrainingCenters().subscribe({
      next: (centers) => {
        const options = this.toOptions(centers);
        this.trainingCenters.set(options);
        if (this.activeCenterPkid() === null && options.length) {
          this.activeCenterPkid.set(options[0].value);
          this.persistFilters();
        }
        this.load();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: '載入失敗',
          detail: '無法取得訓練中心資料。',
        });
        // Fall back to the unscoped week so the grid is not left blank.
        this.load();
      },
    });
  }

  load(): void {
    this.loading.set(true);
    this.service
      .query({
        trainingCenterPkid: this.activeCenterPkid(),
        weekStart: toIso(this.weekStart()),
      })
      .subscribe({
        next: (data) => {
          this.items.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: '載入失敗',
            detail: '無法取得上稿資料。',
          });
        },
      });
  }

  /** The row pinned to a cell, or null when the cell is empty. */
  itemAt(iso: string, slot: number): FeaturedPromoItem | null {
    return this.items().find((i) => i.scheduleOn.substring(0, 10) === iso && i.slot === slot) ?? null;
  }

  isEditing(iso: string, slot: number): boolean {
    const target = this.editing();
    return target !== null && target.scheduleOn === iso && target.slot === slot;
  }

  editTarget(): EditTarget | null {
    return this.editing();
  }

  // ---- Tabs / week navigation ----

  // p-tabs types its valueChange as string | number | undefined; ignore an empty emission.
  selectCenter(pkid: number | string | undefined): void {
    if (pkid === undefined || pkid === '') return;
    this.activeCenterPkid.set(Number(pkid));
    this.editing.set(null);
    this.persistFilters();
    this.load();
  }

  prevWeek(): void {
    this.shiftWeek(-7);
  }

  nextWeek(): void {
    this.shiftWeek(7);
  }

  private shiftWeek(days: number): void {
    const start = this.weekStart();
    this.weekStart.set(new Date(start.getFullYear(), start.getMonth(), start.getDate() + days));
    this.editing.set(null);
    this.persistFilters();
    this.load();
  }

  // ---- Cell actions ----

  edit(iso: string, slot: number): void {
    this.editing.set({ scheduleOn: iso, slot, item: this.itemAt(iso, slot), seed: null });
  }

  /** Copy lifts the row's promo fields; Paste opens a New form seeded with them. */
  copy(item: FeaturedPromoItem): void {
    const seed: PromoSeed = {
      promoCode: item.promoCode ?? '',
      topic: item.topic,
      description: item.description,
    };
    this.clipboard.set(seed);
    sessionStorage.setItem(FeaturedPromoItemList.CLIPBOARD_KEY, JSON.stringify(seed));
    this.messageService.add({
      severity: 'info',
      summary: '已複製',
      detail: `已複製「${seed.promoCode}」，可貼上至其他時段。`,
    });
  }

  paste(iso: string, slot: number): void {
    const seed = this.clipboard();
    if (!seed) return;
    this.editing.set({ scheduleOn: iso, slot, item: null, seed });
  }

  onSaved(): void {
    this.editing.set(null);
    this.messageService.add({ severity: 'success', summary: '儲存成功', detail: '上稿資料已儲存。' });
    this.load();
  }

  onCancelled(): void {
    this.editing.set(null);
  }

  /** `+` moves the row down a slot, `-` moves it up; the API swaps with any occupant. */
  move(item: FeaturedPromoItem, delta: number): void {
    this.service.move(item.pkid, delta).subscribe({
      next: () => this.load(),
      error: () =>
        this.messageService.add({
          severity: 'error',
          summary: '移動失敗',
          detail: '無法調整順序。',
        }),
    });
  }

  canMove(slot: number, delta: number): boolean {
    const target = slot + delta;
    return target >= this.slots[0] && target <= this.slots[this.slots.length - 1];
  }

  confirmDelete(item: FeaturedPromoItem): void {
    this.confirmationService.confirm({
      header: '確認刪除',
      message: `確定要刪除「${item.promoCode ?? item.topic}」？`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: '刪除',
      rejectLabel: '取消',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.remove(item),
    });
  }

  private remove(item: FeaturedPromoItem): void {
    this.service.delete(item.pkid).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: '刪除成功',
          detail: '上稿資料已刪除。',
        });
        this.load();
      },
      error: () =>
        this.messageService.add({
          severity: 'error',
          summary: '刪除失敗',
          detail: '刪除上稿資料時發生錯誤。',
        }),
    });
  }

  private toOptions(items: LookupItem[]): Option[] {
    return items.map((i) => ({ value: Number(i.id), label: i.label }));
  }

  // ---- session-storage state ----

  private restoreState(): void {
    const filters = this.readJson<ListFilters>(FeaturedPromoItemList.FILTERS_KEY);
    if (filters) {
      this.activeCenterPkid.set(filters.trainingCenterPkid);
      if (filters.weekStart) this.weekStart.set(mondayOf(parseDate(filters.weekStart)));
    }

    const clipboard = this.readJson<PromoSeed>(FeaturedPromoItemList.CLIPBOARD_KEY);
    if (clipboard) this.clipboard.set(clipboard);
  }

  private persistFilters(): void {
    const filters: ListFilters = {
      trainingCenterPkid: this.activeCenterPkid(),
      weekStart: toIso(this.weekStart()),
    };
    sessionStorage.setItem(FeaturedPromoItemList.FILTERS_KEY, JSON.stringify(filters));
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
