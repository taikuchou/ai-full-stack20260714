import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { CourseDetail } from './course-detail';
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
  certificationCount: 1,
  jobCategoryCount: 1,
  certificationPkids: [5],
  jobCategoryPkids: [3],
};

const CERTS: LookupItem[] = [{ id: '5', label: 'AZ-900 認證' }];
const JOBS: LookupItem[] = [{ id: '3', label: '雲端工程師' }];

describe('CourseDetail', () => {
  let fixture: ComponentFixture<CourseDetail>;
  let component: CourseDetail;
  let serviceSpy: jasmine.SpyObj<CourseService>;
  let router: Router;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<CourseService>('CourseService', [
      'getById',
      'getCertifications',
      'getJobCategories',
    ]);
    serviceSpy.getById.and.returnValue(of(COURSE));
    serviceSpy.getCertifications.and.returnValue(of(CERTS));
    serviceSpy.getJobCategories.and.returnValue(of(JOBS));

    await TestBed.configureTestingModule({
      imports: [CourseDetail],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: CourseService, useValue: serviceSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: (_: string) => '1' } } } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(CourseDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load the course and resolve n-n labels on init', () => {
    expect(serviceSpy.getById).toHaveBeenCalledWith(1);
    expect(component.course()?.title).toBe('Azure 基礎課程');
    expect(component.certificationLabels()).toEqual(['AZ-900 認證']);
    expect(component.jobCategoryLabels()).toEqual(['雲端工程師']);
    expect(component.loading()).toBeFalse();
  });

  it('edit() should navigate to the edit route', () => {
    component.edit();
    expect(router.navigate).toHaveBeenCalledWith(['/courses', 1, 'edit']);
  });

  it('back() should navigate to the list', () => {
    component.back();
    expect(router.navigate).toHaveBeenCalledWith(['/courses']);
  });
});
