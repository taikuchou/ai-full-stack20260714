import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { RowAuditBadge, formatAuditTime, parseUtc } from './row-audit-badge';
import { RowAuditService } from '../../services/row-audit.service';
import { RowAuditHistoryItem } from '../../models/row-audit.model';

/** The API returns UTC with no offset — see RowAuditHistoryItem.dateTime. */
const TRAIL: RowAuditHistoryItem[] = [
  { dateTime: '2026-06-04T06:30:00', userName: 'alice', actionType: 'Update', actionDesc: 'Title, DisplayOrder' },
  { dateTime: '2026-06-02T01:30:00', userName: 'bob', actionType: 'Update', actionDesc: 'Note' },
  { dateTime: '2026-06-01T00:00:00', userName: 'carol', actionType: 'Insert', actionDesc: 'Azure 101' },
];

describe('RowAuditBadge', () => {
  let fixture: ComponentFixture<RowAuditBadge>;
  let component: RowAuditBadge;
  let serviceSpy: jasmine.SpyObj<RowAuditService>;

  /** The badge renders into the document; the dialog uses appendTo="body". */
  function text(testId: string): string | null {
    const el =
      fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) ??
      document.body.querySelector(`[data-testid="${testId}"]`);
    return el?.textContent?.trim() ?? null;
  }

  function rows(): Element[] {
    return Array.from(document.body.querySelectorAll('[data-testid="audit-dialog-row"]'));
  }

  async function createComponent(pkid: number | string | null, trail: RowAuditHistoryItem[] = TRAIL) {
    serviceSpy.getForRecord.and.returnValue(of(trail));

    fixture = TestBed.createComponent(RowAuditBadge);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('tableName', 'Course');
    fixture.componentRef.setInput('pkid', pkid);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<RowAuditService>('RowAuditService', ['getForRecord']);

    await TestBed.configureTestingModule({
      imports: [RowAuditBadge],
      providers: [provideNoopAnimations(), { provide: RowAuditService, useValue: serviceSpy }],
    }).compileComponents();
  });

  afterEach(() => {
    // The dialog appends to body — leftovers would leak between specs.
    document.body.querySelectorAll('.audit-dialog').forEach((el) => el.remove());
  });

  // ---- Timestamp handling ----

  describe('parseUtc', () => {
    it('reads an offset-less API timestamp as UTC, not local time', () => {
      // Guards the bug this would otherwise have: `new Date('2026-06-04T06:30:00')` is local.
      expect(parseUtc('2026-06-04T06:30:00').toISOString()).toBe('2026-06-04T06:30:00.000Z');
    });

    it('respects an explicit zone when the API sends one', () => {
      expect(parseUtc('2026-06-04T06:30:00Z').toISOString()).toBe('2026-06-04T06:30:00.000Z');
      expect(parseUtc('2026-06-04T14:30:00+08:00').toISOString()).toBe('2026-06-04T06:30:00.000Z');
    });
  });

  describe('formatAuditTime', () => {
    it('renders UTC in the viewer local time as YYYY-MM-DD HH:mm', () => {
      const utc = '2026-06-04T06:30:00';
      const expected = new Date('2026-06-04T06:30:00Z');
      const pad = (n: number) => String(n).padStart(2, '0');

      expect(formatAuditTime(utc)).toBe(
        `${expected.getFullYear()}-${pad(expected.getMonth() + 1)}-${pad(expected.getDate())} ` +
          `${pad(expected.getHours())}:${pad(expected.getMinutes())}`,
      );
    });

    it('returns the raw value rather than "NaN" when the timestamp is unparseable', () => {
      expect(formatAuditTime('not-a-date')).toBe('not-a-date');
    });
  });

  // ---- Inline latest record ----

  it('fetches this record trail on load', async () => {
    await createComponent(123);

    expect(serviceSpy.getForRecord).toHaveBeenCalledWith('Course', 123);
  });

  it('shows the most recent record inline without opening the dialog', async () => {
    await createComponent(123);

    const label = text('audit-badge-latest');
    expect(label).toContain('Update by alice');
    expect(label).toContain(formatAuditTime('2026-06-04T06:30:00'));
    // The newest entry, not merely the first one rendered.
    expect(label).not.toContain('carol');
    expect(rows().length).toBe(0);
  });

  it('always labels the badge bilingually', async () => {
    await createComponent(123);

    expect(fixture.nativeElement.textContent).toContain('異動紀錄 History');
  });

  // ---- Full trail dialog ----

  it('opens a dialog listing the full trail, newest first', async () => {
    await createComponent(123);

    fixture.nativeElement.querySelector('[data-testid="audit-badge"]').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.dialogVisible()).toBeTrue();
    expect(rows().length).toBe(3);

    const users = rows().map((r) => r.textContent);
    expect(users[0]).toContain('alice');
    expect(users[1]).toContain('bob');
    expect(users[2]).toContain('carol');
  });

  it('shows every field of a change in the dialog', async () => {
    await createComponent(123);
    component.open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const first = rows()[0].textContent ?? '';
    expect(first).toContain(formatAuditTime('2026-06-04T06:30:00'));
    expect(first).toContain('alice');
    expect(first).toContain('Update');
    expect(first).toContain('Title, DisplayOrder');
  });

  it('renders a dash for a null actionDesc', async () => {
    await createComponent(123, [
      { dateTime: '2026-06-01T00:00:00', userName: 'carol', actionType: 'Insert', actionDesc: null },
    ]);
    component.open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(rows()[0].textContent).toContain('—');
  });

  // ---- Empty state ----

  it('shows the no-history state for a record with an empty trail', async () => {
    await createComponent(123, []);

    expect(text('audit-badge-empty')).toContain('尚無異動紀錄 No history');
    expect(text('audit-badge-latest')).toBeNull();
  });

  it('shows the no-history state in the dialog too', async () => {
    await createComponent(123, []);
    component.open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text('audit-dialog-empty')).toContain('No history yet');
    expect(rows().length).toBe(0);
  });

  it('shows the no-history state and queries nothing for a new unsaved record', async () => {
    await createComponent(null);

    expect(serviceSpy.getForRecord).not.toHaveBeenCalled();
    expect(text('audit-badge-empty')).toContain('尚無異動紀錄 No history');
  });

  it('falls back to the empty state rather than breaking the page when the trail fails to load', async () => {
    serviceSpy.getForRecord.and.returnValue(throwError(() => new Error('500')));

    fixture = TestBed.createComponent(RowAuditBadge);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('tableName', 'Course');
    fixture.componentRef.setInput('pkid', 123);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.history()).toEqual([]);
    expect(component.loading()).toBeFalse();
    expect(text('audit-badge-empty')).toContain('尚無異動紀錄 No history');
  });

  // ---- Reuse ----

  it('re-fetches when the host swaps the record', async () => {
    await createComponent(123);

    fixture.componentRef.setInput('pkid', 456);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(serviceSpy.getForRecord).toHaveBeenCalledWith('Course', 456);
  });

  it('passes whichever table the host names', async () => {
    serviceSpy.getForRecord.and.returnValue(of([]));

    fixture = TestBed.createComponent(RowAuditBadge);
    fixture.componentRef.setInput('tableName', 'Partner');
    fixture.componentRef.setInput('pkid', '7');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(serviceSpy.getForRecord).toHaveBeenCalledWith('Partner', '7');
  });
});
