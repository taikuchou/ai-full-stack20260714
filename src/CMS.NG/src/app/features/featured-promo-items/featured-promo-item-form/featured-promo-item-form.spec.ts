import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { FeaturedPromoItemForm, PromoSeed } from './featured-promo-item-form';
import { FeaturedPromoItemService } from '../../../core/services/featured-promo-item.service';
import {
  FeaturedPromoItem,
  FeaturedPromoItemRequest,
  PromoCodeLookup,
} from '../../../core/models/featured-promo-item.model';

const EXISTING: FeaturedPromoItem = {
  pkid: 1,
  scheduleOn: '2026-03-16',
  trainingCenter_pkid: 1,
  slot: 1,
  promotion_pkid: 20,
  topic: '成為能AI協作的程式設計師',
  description: '轉職就業養成班，三大主流語言任你選',
  trainingCenterName: '台北',
  promoCode: '20251204_SkillTrainAI',
};

const PROMO: PromoCodeLookup = {
  pkid: 20,
  promoCode: '20251204_SkillTrainAI',
  topic: '成為能AI協作的程式設計師',
  description: '轉職就業養成班，三大主流語言任你選',
};

describe('FeaturedPromoItemForm', () => {
  let fixture: ComponentFixture<FeaturedPromoItemForm>;
  let component: FeaturedPromoItemForm;
  let serviceSpy: jasmine.SpyObj<FeaturedPromoItemService>;

  /** Creates the form for a cell. `item` null opens New; `seed` fills a pasted New form. */
  function create(item: FeaturedPromoItem | null, seed: PromoSeed | null = null): void {
    fixture = TestBed.createComponent(FeaturedPromoItemForm);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('scheduleOn', '2026-03-16');
    fixture.componentRef.setInput('slot', 1);
    fixture.componentRef.setInput('trainingCenterPkid', 1);
    fixture.componentRef.setInput('item', item);
    fixture.componentRef.setInput('seed', seed);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<FeaturedPromoItemService>('FeaturedPromoItemService', [
      'create',
      'update',
      'getPromoCodes',
      'resolvePromoCode',
    ]);
    serviceSpy.create.and.returnValue(of({ ...EXISTING, pkid: 9 }));
    serviceSpy.update.and.returnValue(of(EXISTING));
    serviceSpy.getPromoCodes.and.returnValue(
      of([
        { id: '20', label: '20251204_SkillTrainAI' },
        { id: '21', label: '251211_GoogleAI' },
      ]),
    );
    serviceSpy.resolvePromoCode.and.returnValue(of(PROMO));

    await TestBed.configureTestingModule({
      imports: [FeaturedPromoItemForm],
      providers: [provideNoopAnimations(), { provide: FeaturedPromoItemService, useValue: serviceSpy }],
    }).compileComponents();
  });

  // ---- Edit form ----

  it('should prefill the Edit form from the existing row', () => {
    create(EXISTING);

    expect(component.isNew).toBeFalse();
    expect(component.form.getRawValue()).toEqual({
      promoCode: '20251204_SkillTrainAI',
      topic: '成為能AI協作的程式設計師',
      description: '轉職就業養成班，三大主流語言任你選',
    });
  });

  it('save() on an Edit form should resolve the code then PUT, carrying the pkid', () => {
    create(EXISTING);
    component.form.controls.topic.setValue('新主題');
    component.save();

    expect(serviceSpy.resolvePromoCode).toHaveBeenCalledWith('20251204_SkillTrainAI');
    expect(serviceSpy.update).toHaveBeenCalledTimes(1);
    expect(serviceSpy.create).not.toHaveBeenCalled();

    const body = serviceSpy.update.calls.mostRecent().args[0] as FeaturedPromoItemRequest;
    expect(body.pkid).toBe(1);
    expect(body.promotion_pkid).toBe(20);
    expect(body.topic).toBe('新主題');
  });

  // ---- New form ----

  it('should open the New form empty', () => {
    create(null);

    expect(component.isNew).toBeTrue();
    expect(component.form.getRawValue()).toEqual({ promoCode: '', topic: '', description: '' });
  });

  it('should prefill the New form from pasted values', () => {
    const seed: PromoSeed = { promoCode: '251211_GoogleAI', topic: 'T', description: 'D' };
    create(null, seed);

    expect(component.isNew).toBeTrue();
    expect(component.form.getRawValue()).toEqual(seed);
  });

  it('save() on a New form should POST with the cell coordinates and pkid 0', () => {
    create(null);
    component.form.setValue({
      promoCode: '20251204_SkillTrainAI',
      topic: '主題',
      description: '說明',
    });
    component.save();

    expect(serviceSpy.create).toHaveBeenCalledTimes(1);
    expect(serviceSpy.update).not.toHaveBeenCalled();

    const body = serviceSpy.create.calls.mostRecent().args[0] as FeaturedPromoItemRequest;
    expect(body).toEqual({
      pkid: 0,
      scheduleOn: '2026-03-16',
      trainingCenter_pkid: 1,
      slot: 1,
      promotion_pkid: 20,
      topic: '主題',
      description: '說明',
    });
  });

  it('save() should emit saved with the persisted row', () => {
    create(null);
    component.form.setValue({ promoCode: '20251204_SkillTrainAI', topic: 'T', description: 'D' });

    let emitted: FeaturedPromoItem | null = null;
    component.saved.subscribe((i) => (emitted = i));
    component.save();

    expect(emitted!).toEqual({ ...EXISTING, pkid: 9 });
  });

  // ---- Validation ----

  it('save() should do nothing while a required field is empty', () => {
    create(null);
    component.form.setValue({ promoCode: '', topic: 'T', description: 'D' });
    component.save();

    expect(serviceSpy.resolvePromoCode).not.toHaveBeenCalled();
    expect(serviceSpy.create).not.toHaveBeenCalled();
    expect(component.form.controls.promoCode.touched).toBeTrue();
  });

  // ---- PromoCode lookup ----

  it('save() should block and report when the code matches no promo', () => {
    create(null);
    serviceSpy.resolvePromoCode.and.returnValue(throwError(() => new Error('404')));
    component.form.setValue({ promoCode: 'NOPE', topic: 'T', description: 'D' });
    component.save();

    expect(serviceSpy.create).not.toHaveBeenCalled();
    expect(component.promoCodeError()).toContain('NOPE');
    expect(component.saving()).toBeFalse();
  });

  it('save() should trim the typed code before resolving it', () => {
    create(null);
    component.form.setValue({
      promoCode: '  20251204_SkillTrainAI  ',
      topic: 'T',
      description: 'D',
    });
    component.save();

    expect(serviceSpy.resolvePromoCode).toHaveBeenCalledWith('20251204_SkillTrainAI');
  });

  it('picking a code should seed the empty Topic and Description', () => {
    create(null);
    component.form.controls.promoCode.setValue('20251204_SkillTrainAI');
    component.onPromoCodeSelect();

    expect(component.form.controls.topic.value).toBe(PROMO.topic);
    expect(component.form.controls.description.value).toBe(PROMO.description);
  });

  it('picking a code should never overwrite text already entered', () => {
    create(null);
    component.form.setValue({
      promoCode: '20251204_SkillTrainAI',
      topic: '自訂主題',
      description: '自訂說明',
    });
    component.onPromoCodeSelect();

    expect(component.form.controls.topic.value).toBe('自訂主題');
    expect(component.form.controls.description.value).toBe('自訂說明');
  });

  it('save() should reuse the resolve from the pick rather than call the lookup twice', () => {
    create(null);
    component.form.controls.promoCode.setValue('20251204_SkillTrainAI');
    component.onPromoCodeSelect();
    component.save();

    expect(serviceSpy.resolvePromoCode).toHaveBeenCalledTimes(1);
    expect(serviceSpy.create).toHaveBeenCalledTimes(1);
  });

  it('save() should re-resolve when the code changed after the pick', () => {
    create(null);
    component.form.controls.promoCode.setValue('20251204_SkillTrainAI');
    component.onPromoCodeSelect();

    component.form.setValue({ promoCode: '251211_GoogleAI', topic: 'T', description: 'D' });
    serviceSpy.resolvePromoCode.and.returnValue(of({ ...PROMO, pkid: 21, promoCode: '251211_GoogleAI' }));
    component.save();

    expect(serviceSpy.resolvePromoCode).toHaveBeenCalledTimes(2);
    const body = serviceSpy.create.calls.mostRecent().args[0] as FeaturedPromoItemRequest;
    expect(body.promotion_pkid).toBe(21);
  });

  it('onPromoCodeSelect() should ignore an empty code', () => {
    create(null);
    component.onPromoCodeSelect();

    expect(serviceSpy.resolvePromoCode).not.toHaveBeenCalled();
  });

  // ---- Cancel ----

  it('cancel() should emit cancelled without saving', () => {
    create(EXISTING);
    let cancelled = false;
    component.cancelled.subscribe(() => (cancelled = true));
    component.cancel();

    expect(cancelled).toBeTrue();
    expect(serviceSpy.update).not.toHaveBeenCalled();
  });
});
