import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { FeaturedPromoItemList } from './featured-promo-item-list';
import { FeaturedPromoItemService } from '../../../core/services/featured-promo-item.service';
import { FeaturedPromoItem, LookupItem } from '../../../core/models/featured-promo-item.model';

function item(pkid: number, scheduleOn: string, slot: number): FeaturedPromoItem {
  return {
    pkid,
    scheduleOn,
    trainingCenter_pkid: 1,
    slot,
    promotion_pkid: 20 + pkid,
    topic: `主題 ${pkid}`,
    description: `說明 ${pkid}`,
    trainingCenterName: '台北',
    promoCode: `CODE-${pkid}`,
  };
}

const CENTERS: LookupItem[] = [
  { id: '1', label: '台北' },
  { id: '2', label: '新竹' },
  { id: '3', label: '台中' },
];

// The week the mockups show: Monday 2026-03-16 through Sunday 2026-03-22.
const ITEMS: FeaturedPromoItem[] = [
  item(1, '2026-03-16', 1),
  item(2, '2026-03-16', 2),
  item(3, '2026-03-17', 1),
];

const FILTERS_KEY = 'featured-promo-item-list-filters';
const CLIPBOARD_KEY = 'featured-promo-item-clipboard';

describe('FeaturedPromoItemList', () => {
  let fixture: ComponentFixture<FeaturedPromoItemList>;
  let component: FeaturedPromoItemList;
  let serviceSpy: jasmine.SpyObj<FeaturedPromoItemService>;

  /** Creates the component after sessionStorage has been seeded by the test. */
  function create(): void {
    fixture = TestBed.createComponent(FeaturedPromoItemList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<FeaturedPromoItemService>('FeaturedPromoItemService', [
      'query',
      'delete',
      'move',
      'getTrainingCenters',
    ]);
    serviceSpy.query.and.returnValue(of(ITEMS));
    serviceSpy.delete.and.returnValue(of(void 0));
    serviceSpy.move.and.returnValue(of(void 0));
    serviceSpy.getTrainingCenters.and.returnValue(of(CENTERS));

    await TestBed.configureTestingModule({
      imports: [FeaturedPromoItemList],
      providers: [provideNoopAnimations(), { provide: FeaturedPromoItemService, useValue: serviceSpy }],
    }).compileComponents();

    sessionStorage.clear();
    // Pin the grid to the mockups' week so the day labels are deterministic.
    sessionStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({ trainingCenterPkid: 1, weekStart: '2026-03-16' }),
    );
  });

  afterEach(() => sessionStorage.clear());

  // ---- Load ----

  it('should load the week via query() once on init, scoped to the restored tab and week', () => {
    create();

    expect(serviceSpy.query).toHaveBeenCalledTimes(1);
    expect(serviceSpy.query).toHaveBeenCalledWith({
      trainingCenterPkid: 1,
      weekStart: '2026-03-16',
    });
    expect(component.items().length).toBe(3);
  });

  it('should default to the first TrainingCenter tab when nothing is stored', () => {
    sessionStorage.clear();
    create();

    expect(component.activeCenterPkid()).toBe(1);
    expect(component.trainingCenters().length).toBe(3);
    expect(serviceSpy.query).toHaveBeenCalledTimes(1);
    expect(serviceSpy.query.calls.mostRecent().args[0].trainingCenterPkid).toBe(1);
  });

  it('should still load the week when the TrainingCenter lookup fails', () => {
    sessionStorage.clear();
    serviceSpy.getTrainingCenters.and.returnValue(throwError(() => new Error('boom')));
    create();

    expect(serviceSpy.query).toHaveBeenCalledTimes(1);
  });

  // ---- The one-week (Monday–Sunday) window ----

  it('days() should expose seven columns, Monday through Sunday', () => {
    create();
    const days = component.days();

    expect(days.length).toBe(7);
    expect(days[0].iso).toBe('2026-03-16');
    expect(days[6].iso).toBe('2026-03-22');
    expect(days[0].label).toBe('3/16 (一)');
    expect(days[6].label).toBe('3/22 (日)');
  });

  it('should snap a stored mid-week date back to that week Monday', () => {
    // Thursday 2026-03-19 belongs to the 3/16 week.
    sessionStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({ trainingCenterPkid: 1, weekStart: '2026-03-19' }),
    );
    create();

    expect(component.days()[0].iso).toBe('2026-03-16');
    expect(serviceSpy.query.calls.mostRecent().args[0].weekStart).toBe('2026-03-16');
  });

  it('weekLabel() should read as the mockup header', () => {
    create();
    expect(component.weekLabel()).toBe('3/16 -- 3/22');
  });

  it('nextWeek() should advance seven days, persist and reload', () => {
    create();
    component.nextWeek();

    expect(component.days()[0].iso).toBe('2026-03-23');
    expect(serviceSpy.query).toHaveBeenCalledTimes(2);
    expect(serviceSpy.query.calls.mostRecent().args[0].weekStart).toBe('2026-03-23');
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).weekStart).toBe('2026-03-23');
  });

  it('prevWeek() should step back seven days and reload', () => {
    create();
    component.prevWeek();

    expect(component.days()[0].iso).toBe('2026-03-09');
    expect(serviceSpy.query.calls.mostRecent().args[0].weekStart).toBe('2026-03-09');
  });

  // ---- TrainingCenter tabs ----

  it('selectCenter() should switch tab, persist and reload for that centre', () => {
    create();
    component.selectCenter(2);

    expect(component.activeCenterPkid()).toBe(2);
    expect(serviceSpy.query).toHaveBeenCalledTimes(2);
    expect(serviceSpy.query.calls.mostRecent().args[0].trainingCenterPkid).toBe(2);
    expect(JSON.parse(sessionStorage.getItem(FILTERS_KEY)!).trainingCenterPkid).toBe(2);
  });

  it('selectCenter() should coerce the tab value p-tabs emits as a string', () => {
    create();
    component.selectCenter('3');

    expect(component.activeCenterPkid()).toBe(3);
  });

  it('selectCenter() should ignore an empty emission rather than reload unscoped', () => {
    create();
    component.selectCenter(undefined);

    expect(component.activeCenterPkid()).toBe(1);
    expect(serviceSpy.query).toHaveBeenCalledTimes(1);
  });

  it('selectCenter() should close an open inline form', () => {
    create();
    component.edit('2026-03-16', 1);
    component.selectCenter(2);

    expect(component.editing()).toBeNull();
  });

  // ---- Grid mapping ----

  it('itemAt() should find the row pinned to a cell', () => {
    create();
    expect(component.itemAt('2026-03-16', 1)?.pkid).toBe(1);
    expect(component.itemAt('2026-03-16', 2)?.pkid).toBe(2);
    expect(component.itemAt('2026-03-17', 1)?.pkid).toBe(3);
  });

  it('itemAt() should return null for an empty cell', () => {
    create();
    expect(component.itemAt('2026-03-16', 3)).toBeNull();
    expect(component.itemAt('2026-03-18', 1)).toBeNull();
  });

  it('canMove() should stop at the edges of the 1-3 slot range', () => {
    create();
    expect(component.canMove(1, -1)).toBeFalse();
    expect(component.canMove(1, 1)).toBeTrue();
    expect(component.canMove(3, 1)).toBeFalse();
    expect(component.canMove(3, -1)).toBeTrue();
  });

  // ---- Edit / New ----

  it('edit() should open the inline form on the row in that cell', () => {
    create();
    component.edit('2026-03-16', 1);

    expect(component.isEditing('2026-03-16', 1)).toBeTrue();
    expect(component.editTarget()?.item?.pkid).toBe(1);
    expect(component.editTarget()?.seed).toBeNull();
  });

  it('edit() on an empty cell should open an empty New form', () => {
    create();
    component.edit('2026-03-18', 3);

    expect(component.isEditing('2026-03-18', 3)).toBeTrue();
    expect(component.editTarget()?.item).toBeNull();
    expect(component.editTarget()?.seed).toBeNull();
  });

  it('isEditing() should be true only for the open cell', () => {
    create();
    component.edit('2026-03-16', 1);

    expect(component.isEditing('2026-03-16', 2)).toBeFalse();
    expect(component.isEditing('2026-03-17', 1)).toBeFalse();
  });

  it('onSaved() should close the form and reload', () => {
    create();
    component.edit('2026-03-16', 1);
    component.onSaved();

    expect(component.editing()).toBeNull();
    expect(serviceSpy.query).toHaveBeenCalledTimes(2);
  });

  it('onCancelled() should close the form without reloading', () => {
    create();
    component.edit('2026-03-16', 1);
    component.onCancelled();

    expect(component.editing()).toBeNull();
    expect(serviceSpy.query).toHaveBeenCalledTimes(1);
  });

  // ---- Copy / Paste ----

  it('copy() should lift the row promo fields into the clipboard and sessionStorage', () => {
    create();
    component.copy(ITEMS[0]);

    expect(component.clipboard()).toEqual({
      promoCode: 'CODE-1',
      topic: '主題 1',
      description: '說明 1',
    });
    expect(JSON.parse(sessionStorage.getItem(CLIPBOARD_KEY)!).promoCode).toBe('CODE-1');
  });

  it('paste() should open a New form seeded with the copied values', () => {
    create();
    component.copy(ITEMS[0]);
    component.paste('2026-03-18', 2);

    expect(component.isEditing('2026-03-18', 2)).toBeTrue();
    expect(component.editTarget()?.item).toBeNull();
    expect(component.editTarget()?.seed?.promoCode).toBe('CODE-1');
  });

  it('paste() should do nothing when nothing has been copied', () => {
    create();
    component.paste('2026-03-18', 2);

    expect(component.editing()).toBeNull();
  });

  it('should restore a clipboard copied earlier in the session', () => {
    sessionStorage.setItem(
      CLIPBOARD_KEY,
      JSON.stringify({ promoCode: 'CODE-9', topic: 'T', description: 'D' }),
    );
    create();

    expect(component.clipboard()?.promoCode).toBe('CODE-9');
  });

  // ---- Slot move ----

  it('move() should send +1 for the down arrow and reload', () => {
    create();
    component.move(ITEMS[0], 1);

    expect(serviceSpy.move).toHaveBeenCalledWith(1, 1);
    expect(serviceSpy.query).toHaveBeenCalledTimes(2);
  });

  it('move() should send -1 for the up arrow', () => {
    create();
    component.move(ITEMS[1], -1);

    expect(serviceSpy.move).toHaveBeenCalledWith(2, -1);
  });

  it('move() should not reload when the API rejects the move', () => {
    create();
    serviceSpy.move.and.returnValue(throwError(() => new Error('out of range')));
    component.move(ITEMS[0], 1);

    expect(serviceSpy.query).toHaveBeenCalledTimes(1);
  });

  // ---- Delete ----

  it('confirmDelete() should ask for confirmation and delete on accept', () => {
    create();
    const confirmationService = fixture.debugElement.injector.get(ConfirmationService);
    const confirmSpy = spyOn(confirmationService, 'confirm').and.callFake((opts: any) => {
      opts.accept();
      return confirmationService;
    });

    component.confirmDelete(ITEMS[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(serviceSpy.delete).toHaveBeenCalledWith(1);
    expect(serviceSpy.query).toHaveBeenCalledTimes(2);
  });

  it('confirmDelete() should not delete when the confirmation is dismissed', () => {
    create();
    const confirmationService = fixture.debugElement.injector.get(ConfirmationService);
    spyOn(confirmationService, 'confirm').and.returnValue(confirmationService);

    component.confirmDelete(ITEMS[0]);

    expect(serviceSpy.delete).not.toHaveBeenCalled();
  });
});
