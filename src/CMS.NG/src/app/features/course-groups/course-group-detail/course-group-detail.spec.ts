import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { CourseGroupDetail } from './course-group-detail';
import { CourseGroupService } from '../../../core/services/course-group.service';
import { CourseGroup } from '../../../core/models/course-group.model';

const COURSE_GROUP: CourseGroup = { pkid: 1, description: '資訊安全' };

describe('CourseGroupDetail', () => {
  let fixture: ComponentFixture<CourseGroupDetail>;
  let component: CourseGroupDetail;
  let serviceSpy: jasmine.SpyObj<CourseGroupService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<CourseGroupService>('CourseGroupService', ['getById']);
    serviceSpy.getById.and.returnValue(of(COURSE_GROUP));
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [CourseGroupDetail],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CourseGroupService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: (_: string) => '1' } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CourseGroupDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load the course group by numeric pkid on init', () => {
    expect(serviceSpy.getById).toHaveBeenCalledWith(1);
    expect(component.courseGroup()?.description).toBe('資訊安全');
    expect(component.loading()).toBeFalse();
  });

  it('edit() should navigate to the edit route', () => {
    component.edit();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/course-groups', 1, 'edit']);
  });

  it('back() should navigate to the list', () => {
    component.back();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/course-groups']);
  });
});
