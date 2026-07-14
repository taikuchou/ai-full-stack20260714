import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService } from 'primeng/api';
import { of } from 'rxjs';

import { CourseGroupList } from './course-group-list';
import { CourseGroupService } from '../../../core/services/course-group.service';
import { CourseGroup } from '../../../core/models/course-group.model';

const COURSE_GROUPS: CourseGroup[] = [
  { pkid: 1, description: '資訊安全' },
  { pkid: 2, description: '雲端技術' },
];

describe('CourseGroupList', () => {
  let fixture: ComponentFixture<CourseGroupList>;
  let component: CourseGroupList;
  let serviceSpy: jasmine.SpyObj<CourseGroupService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<CourseGroupService>('CourseGroupService', ['query', 'delete']);
    serviceSpy.query.and.returnValue(of(COURSE_GROUPS));
    serviceSpy.delete.and.returnValue(of(void 0));
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [CourseGroupList],
      providers: [
        provideNoopAnimations(),
        { provide: CourseGroupService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    sessionStorage.clear();
    fixture = TestBed.createComponent(CourseGroupList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load course groups via query() on init', () => {
    expect(serviceSpy.query).toHaveBeenCalledTimes(1);
    expect(component.courseGroups().length).toBe(2);
  });

  it('applyFilter() should persist filters to sessionStorage and reload', () => {
    component.filter.keyword = '資訊';
    component.applyFilter();

    const saved = JSON.parse(sessionStorage.getItem('course-group-list-filters')!);
    expect(saved.keyword).toBe('資訊');
    expect(serviceSpy.query).toHaveBeenCalledTimes(2);
  });

  it('add() should navigate to the new route', () => {
    component.add();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/course-groups/new']);
  });

  it('confirmDelete() should ask for confirmation and delete on accept', () => {
    const confirmationService = fixture.debugElement.injector.get(ConfirmationService);
    const confirmSpy = spyOn(confirmationService, 'confirm').and.callFake((opts: any) => {
      opts.accept();
      return confirmationService;
    });

    component.confirmDelete(COURSE_GROUPS[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(serviceSpy.delete).toHaveBeenCalledWith(1);
  });
});
