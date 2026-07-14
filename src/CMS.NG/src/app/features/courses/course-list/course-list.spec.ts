import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService } from 'primeng/api';
import { of } from 'rxjs';

import { CourseList } from './course-list';
import { CourseService } from '../../../core/services/course.service';
import { Course } from '../../../core/models/course.model';

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

const COURSES: Course[] = [course(1, 'Azure 基礎課程'), course(2, 'AWS 進階課程')];

describe('CourseList', () => {
  let fixture: ComponentFixture<CourseList>;
  let component: CourseList;
  let serviceSpy: jasmine.SpyObj<CourseService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<CourseService>('CourseService', [
      'query',
      'delete',
      'getPartners',
      'getCourseGroups',
      'getPublishStatuses',
    ]);
    serviceSpy.query.and.returnValue(of(COURSES));
    serviceSpy.delete.and.returnValue(of(void 0));
    serviceSpy.getPartners.and.returnValue(of([]));
    serviceSpy.getCourseGroups.and.returnValue(of([]));
    serviceSpy.getPublishStatuses.and.returnValue(of([]));
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

    component.confirmDelete(COURSES[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(serviceSpy.delete).toHaveBeenCalledWith(1);
  });
});
