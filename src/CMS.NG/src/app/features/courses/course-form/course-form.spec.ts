import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { CourseForm } from './course-form';
import { CourseService } from '../../../core/services/course.service';
import { Course, LookupItem } from '../../../core/models/course.model';

const COURSE: Course = {
  pkid: 1,
  title: 'Azure 基礎課程',
  officialTitle: 'Microsoft Azure Fundamentals',
  courseId: 'AZ-900',
  prodCourseId: 'PROD-AZ900',
  friendlyUrl: 'azure-fundamentals',
  displayOrder: 10,
  partner_pkid: 1,
  courseGroup_pkid: 2,
  publishStatus_pkid: 1,
  partnerName: '微軟',
  courseGroupDescription: '雲端課程',
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
  canRepeat: true,
  certificationCount: 0,
  jobCategoryCount: 0,
  certificationPkids: [5],
  jobCategoryPkids: [3],
};

const PARTNERS: LookupItem[] = [{ id: '1', label: '微軟' }];
const GROUPS: LookupItem[] = [{ id: '2', label: '雲端課程' }];
const STATUSES: LookupItem[] = [{ id: '1', label: '已發布' }];
const CERTS: LookupItem[] = [{ id: '5', label: 'AZ-900 認證' }];
const JOBS: LookupItem[] = [{ id: '3', label: '雲端工程師' }];

describe('CourseForm', () => {
  let serviceSpy: jasmine.SpyObj<CourseService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let routeId: string | null;

  function setup(id: string | null): ComponentFixture<CourseForm> {
    routeId = id;
    const fixture = TestBed.createComponent(CourseForm);
    fixture.detectChanges(); // triggers ngOnInit
    return fixture;
  }

  beforeEach(async () => {
    routeId = null;
    serviceSpy = jasmine.createSpyObj<CourseService>('CourseService', [
      'getById',
      'create',
      'update',
      'getPartners',
      'getCourseGroups',
      'getPublishStatuses',
      'getCertifications',
      'getJobCategories',
    ]);
    serviceSpy.getById.and.returnValue(of(COURSE));
    serviceSpy.create.and.returnValue(of({ ...COURSE, pkid: 7 }));
    serviceSpy.update.and.returnValue(of(COURSE));
    serviceSpy.getPartners.and.returnValue(of(PARTNERS));
    serviceSpy.getCourseGroups.and.returnValue(of(GROUPS));
    serviceSpy.getPublishStatuses.and.returnValue(of(STATUSES));
    serviceSpy.getCertifications.and.returnValue(of(CERTS));
    serviceSpy.getJobCategories.and.returnValue(of(JOBS));
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [CourseForm],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CourseService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_: string) => routeId } } },
        },
      ],
    }).compileComponents();
  });

  describe('add mode', () => {
    it('should be in add mode and not load an existing record', () => {
      const fixture = setup(null);
      expect(fixture.componentInstance.isEdit()).toBeFalse();
      expect(serviceSpy.getById).not.toHaveBeenCalled();
    });

    it('should not call create() when the form is invalid (empty required fields)', () => {
      const fixture = setup(null);
      fixture.componentInstance.save();
      expect(serviceSpy.create).not.toHaveBeenCalled();
    });

    it('should call create() (pkid 0) and navigate to the DB-assigned pkid when valid', () => {
      const fixture = setup(null);
      const component = fixture.componentInstance;
      component.form.patchValue({
        title: 'AWS 進階課程',
        courseId: 'AWS-200',
        prodCourseId: 'PROD-AWS200',
        friendlyUrl: 'aws-advanced',
        displayOrder: 20,
        partner_pkid: 1,
        publishStatus_pkid: 1,
        scheduleOn: new Date(2026, 0, 1),
        scheduleOff: new Date(2036, 0, 1),
        hour: 16,
        listPrice: 20000,
        learningCredit: 5,
      });
      component.save();

      expect(serviceSpy.create).toHaveBeenCalledTimes(1);
      const arg = serviceSpy.create.calls.mostRecent().args[0];
      expect(arg.pkid).toBe(0);
      expect(arg.title).toBe('AWS 進階課程');
      expect(arg.scheduleOn).toBe('2026-01-01');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/courses', 7]);
    });
  });

  describe('sticky action toolbar', () => {
    function expectStickyToolbar(fixture: ComponentFixture<CourseForm>): void {
      const toolbar = fixture.nativeElement.querySelector('.page-header') as HTMLElement;
      expect(toolbar).withContext('action toolbar renders').toBeTruthy();

      const style = getComputedStyle(toolbar);
      expect(style.position).toBe('sticky');
      expect(style.top).toBe('0px');
      expect(Number(style.zIndex)).toBeGreaterThan(0);

      const labels = Array.from(
        toolbar.querySelectorAll('.page-actions button')
      ).map((b) => (b.textContent ?? '').trim());
      expect(labels).toContain('儲存');
      expect(labels).toContain('取消');
    }

    it('should pin the toolbar with Save/Cancel on the new form', () => {
      expectStickyToolbar(setup(null));
    });

    it('should pin the toolbar with Save/Cancel on the edit form', () => {
      expectStickyToolbar(setup('1'));
    });
  });

  describe('edit mode', () => {
    it('should load the course and patch the form', () => {
      const fixture = setup('1');
      const component = fixture.componentInstance;
      expect(component.isEdit()).toBeTrue();
      expect(serviceSpy.getById).toHaveBeenCalledWith(1);
      expect(component.form.controls.title.value).toBe('Azure 基礎課程');
      expect(component.form.controls.certificationPkids.value).toEqual([5]);
    });

    it('should call update() carrying the pkid on save', () => {
      const fixture = setup('1');
      const component = fixture.componentInstance;
      component.form.controls.title.setValue('Azure 基礎課程（已編輯）');
      component.save();

      expect(serviceSpy.update).toHaveBeenCalledTimes(1);
      const arg = serviceSpy.update.calls.mostRecent().args[0];
      expect(arg.pkid).toBe(1);
      expect(arg.title).toBe('Azure 基礎課程（已編輯）');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/courses', 1]);
    });
  });
});
