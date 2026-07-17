import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { FeaturedPromoItemService } from '../../../core/services/featured-promo-item.service';
import {
  FeaturedPromoItem,
  FeaturedPromoItemRequest,
  PromoCodeLookup,
} from '../../../core/models/featured-promo-item.model';

/** The three fields Copy lifts off a row and Paste drops into a new one. */
export interface PromoSeed {
  promoCode: string;
  topic: string;
  description: string;
}

/**
 * Inline Edit / New form for one cell of the schedule grid.
 *
 * The cell coordinates (date, centre, slot) are fixed by where the form opened, so the only inputs
 * are PromoCode, Topic and Description. PromoCode is typed (or picked from the autocomplete) and
 * resolved to a Promotion2 pkid on save — a code that matches no promo blocks the save.
 */
@Component({
  selector: 'app-featured-promo-item-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AutoCompleteModule, ButtonModule, InputTextModule],
  templateUrl: './featured-promo-item-form.html',
  styleUrl: './featured-promo-item-form.scss',
})
export class FeaturedPromoItemForm implements OnInit {
  private readonly service = inject(FeaturedPromoItemService);
  private readonly fb = inject(FormBuilder);

  /** The cell being edited. */
  readonly scheduleOn = input.required<string>();
  readonly slot = input.required<number>();
  readonly trainingCenterPkid = input.required<number>();

  /** The row being edited; null opens an empty New form. */
  readonly item = input<FeaturedPromoItem | null>(null);

  /** Values pasted from a copied row. Only consulted when `item` is null. */
  readonly seed = input<PromoSeed | null>(null);

  readonly saved = output<FeaturedPromoItem>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly promoCodeError = signal<string | null>(null);
  readonly suggestions = signal<string[]>([]);

  private allPromoCodes: string[] = [];
  /** Last successful resolve, reused on save when the code is unchanged. */
  private resolved: PromoCodeLookup | null = null;

  readonly form = this.fb.nonNullable.group({
    promoCode: ['', [Validators.required, Validators.maxLength(30)]],
    topic: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.maxLength(300)]],
  });

  get isNew(): boolean {
    return this.item() === null;
  }

  ngOnInit(): void {
    const existing = this.item();
    const pasted = this.seed();

    if (existing) {
      this.form.patchValue({
        promoCode: existing.promoCode ?? '',
        topic: existing.topic,
        description: existing.description,
      });
    } else if (pasted) {
      this.form.patchValue(pasted);
    }

    this.service.getPromoCodes().subscribe({
      next: (codes) => (this.allPromoCodes = codes.map((c) => c.label)),
      // The autocomplete is a convenience — typing a code by hand still works without it.
      error: () => (this.allPromoCodes = []),
    });
  }

  search(event: { query: string }): void {
    const q = event.query.toLowerCase();
    this.suggestions.set(this.allPromoCodes.filter((c) => c.toLowerCase().includes(q)));
  }

  /** Picking a code seeds Topic / Description, but never overwrites text already entered. */
  onPromoCodeSelect(): void {
    const code = this.form.controls.promoCode.value.trim();
    if (!code) return;

    this.service.resolvePromoCode(code).subscribe({
      next: (promo) => {
        this.resolved = promo;
        this.promoCodeError.set(null);
        if (!this.form.controls.topic.value) this.form.controls.topic.setValue(promo.topic);
        if (!this.form.controls.description.value) {
          this.form.controls.description.setValue(promo.description);
        }
      },
      error: () => (this.resolved = null),
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const code = this.form.controls.promoCode.value.trim();

    // Reuse the resolve from the autocomplete pick when the code has not changed since.
    if (this.resolved && this.resolved.promoCode === code) {
      this.persist(this.resolved.pkid);
      return;
    }

    this.saving.set(true);
    this.service.resolvePromoCode(code).subscribe({
      next: (promo) => {
        this.resolved = promo;
        this.persist(promo.pkid);
      },
      error: () => {
        this.saving.set(false);
        this.promoCodeError.set(`找不到活動代碼「${code}」。`);
      },
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }

  private persist(promotionPkid: number): void {
    const value = this.form.getRawValue();
    const request: FeaturedPromoItemRequest = {
      pkid: this.item()?.pkid ?? 0,
      scheduleOn: this.scheduleOn(),
      trainingCenter_pkid: this.trainingCenterPkid(),
      slot: this.slot(),
      promotion_pkid: promotionPkid,
      topic: value.topic.trim(),
      description: value.description.trim(),
    };

    this.saving.set(true);
    const call = this.isNew ? this.service.create(request) : this.service.update(request);
    call.subscribe({
      next: (item) => {
        this.saving.set(false);
        this.saved.emit(item);
      },
      error: () => {
        this.saving.set(false);
        this.promoCodeError.set('儲存失敗，請稍後再試。');
      },
    });
  }
}
