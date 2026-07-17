import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { CourseList } from './course-list';
import { CourseService } from '../../../core/services/course.service';
import { Course, CourseRequest } from '../../../core/models/course.model';

function course(pkid: number, title: string): Course {
  return {
    pkid,
    title,
    officialTitle: null,
    courseId: `C-${pkid}`,
    prodCourseId: `P-${pkid}`,
    friendlyUrl: `course-${pkid}`,
    displayOrder: pkid,
    partner_pkid: 1,
    courseGroup_pkid: null,
    publishStatus_pkid: 1,
    partnerName: '微軟',
    courseGroupDescription: null,
    publishStatusDescription: '已發布',
    scheduleOn: '2026-01-01',
    scheduleOff: '2036-01-01',
    hour: 8,
    listPrice: 12000,
    learningCredit: 3,
    material: null,
    objective: null,
    target: null,
    prerequisites: null,
    outline: null,
    towardCertOrExam: null,
    note: null,
    otherInfo: null,
    canRepeat: false,
    certificationCount: 0,
    jobCategoryCount: 0,
    certificationPkids: [],
    jobCategoryPkids: [],
  };
}

/** Column order of the list table body, used to address cells by index. */
const COL = {
  pkid: 0,
  displayOrder: 1,
  courseId: 2,
  prodCourseId: 3,
  title: 4,
  partnerName: 5,
  courseGroupDescription: 6,
  publishStatus: 7,
  scheduleOn: 8,
  scheduleOff: 9,
  hour: 10,
  listPrice: 11,
  learningCredit: 12,
  canRepeat: 13,
};

describe('CourseList', () => {
  let fixture: ComponentFixture<CourseList>;
  let component: CourseList;
  let serviceSpy: jasmine.SpyObj<CourseService>;
  let routerSpy: jasmine.SpyObj<Router>;

  /** The <td> elements of the first data row. */
  function cells(): HTMLTableCellElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('tbody tr:first-child td'));
  }

  function cell(index: number): HTMLTableCellElement {
    return cells()[index];
  }

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<CourseService>('CourseService', [
      'query',
      'getById',
      'update',
      'delete',
      'getPartners',
      'getCourseGroups',
      'getPublishStatuses',
    ]);
    // Fresh row objects per spec — inline editing mutates them on save.
    serviceSpy.query.and.returnValue(of([course(1, 'Azure 基礎課程'), course(2, 'AWS 進階課程')]));
    serviceSpy.getById.and.callFake((pkid: number) => of(course(pkid, 'Azure 基礎課程')));
    serviceSpy.update.and.callFake((request: CourseRequest) => of(request as unknown as Course));
    serviceSpy.delete.and.returnValue(of(void 0));
    serviceSpy.getPartners.and.returnValue(of([]));
    serviceSpy.getCourseGroups.and.returnValue(of([]));
    serviceSpy.getPublishStatuses.and.returnValue(
      of([
        { id: '1', label: '已發布' },
        { id: '2', label: '草稿' },
      ]),
    );
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [CourseList],
      providers: [
        provideNoopAnimations(),
        { provide: CourseService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    sessionStorage.clear();
    fixture = TestBed.createComponent(CourseList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load courses via query() on init', () => {
    expect(serviceSpy.query).toHaveBeenCalledTimes(1);
    expect(component.courses().length).toBe(2);
  });

  it('applyFilter() should persist filters to sessionStorage and reload', () => {
    component.filter.keyword = 'Azure';
    component.applyFilter();

    const saved = JSON.parse(sessionStorage.getItem('course-list-filters')!);
    expect(saved.keyword).toBe('Azure');
    expect(serviceSpy.query).toHaveBeenCalledTimes(2);
  });

  it('add() should navigate to the new route', () => {
    component.add();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/courses/new']);
  });

  it('confirmDelete() should ask for confirmation and delete on accept', () => {
    const confirmationService = fixture.debugElement.injector.get(ConfirmationService);
    const confirmSpy = spyOn(confirmationService, 'confirm').and.callFake((opts: any) => {
      opts.accept();
      return confirmationService;
    });

    component.confirmDelete(component.courses()[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(serviceSpy.delete).toHaveBeenCalledWith(1);
  });

  // ---- inline editing: entering edit mode ----

  describe('entering edit mode', () => {
    it('double-clicking a cell opens its editor', () => {
      cell(COL.title).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      fixture.detectChanges();

      expect(component.isEditing(component.courses()[0], 'title')).toBeTrue();
      expect(cell(COL.title).querySelector('input')).toBeTruthy();
    });

    it('a single click does not open an editor', () => {
      cell(COL.title).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(component.editing()).toBeNull();
      expect(cell(COL.title).querySelector('input')).toBeNull();
    });

    it('opens the editor matching each column type', () => {
      const first = component.courses()[0];

      component.startEdit(first, 'hour');
      fixture.detectChanges();
      expect(cell(COL.hour).querySelector('p-inputnumber')).toBeTruthy();

      component.startEdit(first, 'scheduleOn');
      fixture.detectChanges();
      expect(cell(COL.scheduleOn).querySelector('p-datepicker')).toBeTruthy();

      component.startEdit(first, 'publishStatus_pkid');
      fixture.detectChanges();
      expect(cell(COL.publishStatus).querySelector('p-select')).toBeTruthy();

      component.startEdit(first, 'canRepeat');
      fixture.detectChanges();
      expect(cell(COL.canRepeat).querySelector('p-checkbox')).toBeTruthy();
    });

    it('seeds a date editor with a Date parsed from the row', () => {
      component.startEdit(component.courses()[0], 'scheduleOn');

      const value = component.editing()!.value as Date;
      expect(value instanceof Date).toBeTrue();
      expect(value.getFullYear()).toBe(2026);
      expect(value.getMonth()).toBe(0);
      expect(value.getDate()).toBe(1);
    });
  });

  // ---- inline editing: read-only columns ----

  describe('read-only columns', () => {
    const READONLY: [string, number][] = [
      ['pkid', COL.pkid],
      ['partnerName', COL.partnerName],
      ['courseGroupDescription', COL.courseGroupDescription],
    ];

    for (const [field, index] of READONLY) {
      it(`${field} cannot be edited`, () => {
        expect(component.canEdit(field)).toBeFalse();

        cell(index).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        component.startEdit(component.courses()[0], field as never);
        fixture.detectChanges();

        expect(component.editing()).toBeNull();
        expect(cell(index).querySelector('input')).toBeNull();
      });
    }

    it('every other column is editable', () => {
      expect(component.canEdit('title')).toBeTrue();
      expect(component.canEdit('publishStatus_pkid')).toBeTrue();
      expect(component.canEdit('canRepeat')).toBeTrue();
    });
  });

  // ---- inline editing: persisting on blur ----

  describe('saving on blur', () => {
    it('blurring the editor calls the update endpoint with the edited value', () => {
      const first = component.courses()[0];
      component.startEdit(first, 'title');
      component.editValue = 'Azure 進階課程';
      fixture.detectChanges();

      cell(COL.title).querySelector('input')!.dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(serviceSpy.update).toHaveBeenCalledTimes(1);
      expect(serviceSpy.update.calls.mostRecent().args[0].title).toBe('Azure 進階課程');
      expect(component.editing()).toBeNull();
      expect(component.courses()[0].title).toBe('Azure 進階課程');
    });

    it('re-fetches the course so the n-n links survive the update', () => {
      const full = course(1, 'Azure 基礎課程');
      full.certificationPkids = [7, 9];
      full.jobCategoryPkids = [3];
      serviceSpy.getById.and.returnValue(of(full));

      component.startEdit(component.courses()[0], 'hour');
      component.editValue = 16;
      component.commit(component.courses()[0]);

      expect(serviceSpy.getById).toHaveBeenCalledWith(1);
      const request = serviceSpy.update.calls.mostRecent().args[0];
      expect(request.certificationPkids).toEqual([7, 9]);
      expect(request.jobCategoryPkids).toEqual([3]);
      expect(request.hour).toBe(16);
    });

    it('sends dates as local yyyy-MM-dd, not a UTC-shifted ISO string', () => {
      component.startEdit(component.courses()[0], 'scheduleOn');
      component.editValue = new Date(2027, 2, 5);
      component.commit(component.courses()[0]);

      expect(serviceSpy.update.calls.mostRecent().args[0].scheduleOn).toBe('2027-03-05');
    });

    it('updates the FK label when 上架狀態 changes', () => {
      component.startEdit(component.courses()[0], 'publishStatus_pkid');
      component.editValue = 2;
      component.commit(component.courses()[0]);

      expect(serviceSpy.update.calls.mostRecent().args[0].publishStatus_pkid).toBe(2);
      expect(component.courses()[0].publishStatusDescription).toBe('草稿');
    });

    it('does not call the endpoint when the value is unchanged', () => {
      component.startEdit(component.courses()[0], 'title');
      component.commit(component.courses()[0]);

      expect(serviceSpy.update).not.toHaveBeenCalled();
      expect(component.editing()).toBeNull();
    });

    it('reverts the cell and surfaces the error when the save fails', () => {
      serviceSpy.update.and.returnValue(throwError(() => new Error('500')));

      component.startEdit(component.courses()[0], 'title');
      component.editValue = '爆炸';
      component.commit(component.courses()[0]);

      expect(component.courses()[0].title).toBe('Azure 基礎課程');
      expect(component.editing()).toBeNull();
      expect(component.savingCell()).toBeFalse();
    });
  });

  // ---- inline editing: validation ----

  describe('validation', () => {
    /** Open a cell, type `value`, blur. Returns the inline error, if any. */
    function editAndCommit(field: Parameters<CourseList['startEdit']>[1], value: unknown): string | null {
      const first = component.courses()[0];
      component.startEdit(first, field);
      component.editValue = value;
      component.commit(first);
      return component.editError();
    }

    it('blocks clearing a required text field and keeps the cell in edit mode', () => {
      const error = editAndCommit('title', '   ');

      expect(error).toBe('課程名稱不可為空白。');
      expect(component.isEditing(component.courses()[0], 'title')).toBeTrue();
      expect(serviceSpy.update).not.toHaveBeenCalled();
      expect(component.courses()[0].title).toBe('Azure 基礎課程');
    });

    it('blocks a negative number', () => {
      expect(editAndCommit('listPrice', -1)).toBe('定價不可為負數。');
      expect(serviceSpy.update).not.toHaveBeenCalled();
    });

    it('blocks a cleared numeric field', () => {
      expect(editAndCommit('hour', null)).toBe('時數必須為數字。');
      expect(serviceSpy.update).not.toHaveBeenCalled();
    });

    it('accepts zero for a numeric field', () => {
      expect(editAndCommit('learningCredit', 0)).toBeNull();
      expect(serviceSpy.update).toHaveBeenCalledTimes(1);
    });

    it('blocks an invalid date', () => {
      expect(editAndCommit('scheduleOff', new Date('nope'))).toBe('下架日期必須是有效日期。');
      expect(serviceSpy.update).not.toHaveBeenCalled();
    });

    it('blocks a cleared date', () => {
      expect(editAndCommit('scheduleOn', null)).toBe('上架日期必須是有效日期。');
      expect(serviceSpy.update).not.toHaveBeenCalled();
    });

    it('blocks 上架日期 later than 下架日期', () => {
      // Row is 2026-01-01 → 2036-01-01.
      expect(editAndCommit('scheduleOn', new Date(2037, 0, 1))).toBe('上架日期不可晚於下架日期。');
      expect(serviceSpy.update).not.toHaveBeenCalled();
    });

    it('blocks 下架日期 earlier than 上架日期', () => {
      expect(editAndCommit('scheduleOff', new Date(2025, 0, 1))).toBe('下架日期不可早於上架日期。');
      expect(serviceSpy.update).not.toHaveBeenCalled();
    });

    it('allows 上架日期 equal to 下架日期', () => {
      expect(editAndCommit('scheduleOn', new Date(2036, 0, 1))).toBeNull();
      expect(serviceSpy.update).toHaveBeenCalledTimes(1);
    });

    it('shows the inline error in the cell and clears it once fixed', () => {
      const first = component.courses()[0];
      component.startEdit(first, 'title');
      component.editValue = '';
      component.commit(first);
      fixture.detectChanges();

      expect(cell(COL.title).querySelector('.cell-error')!.textContent).toContain('課程名稱不可為空白。');

      component.editValue = 'Azure 基礎課程 v2';
      component.commit(first);
      fixture.detectChanges();

      expect(component.editing()).toBeNull();
      expect(cell(COL.title).querySelector('.cell-error')).toBeNull();
      expect(serviceSpy.update).toHaveBeenCalledTimes(1);
    });
  });
});
