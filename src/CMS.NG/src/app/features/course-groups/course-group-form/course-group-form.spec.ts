import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { CourseGroupForm } from './course-group-form';
import { CourseGroupService } from '../../../core/services/course-group.service';
import { CourseGroup } from '../../../core/models/course-group.model';

const COURSE_GROUP: CourseGroup = { pkid: 1, description: '資訊安全' };

describe('CourseGroupForm', () => {
  let serviceSpy: jasmine.SpyObj<CourseGroupService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let routeId: string | null;

  function setup(id: string | null): ComponentFixture<CourseGroupForm> {
    routeId = id;
    const fixture = TestBed.createComponent(CourseGroupForm);
    fixture.detectChanges(); // triggers ngOnInit
    return fixture;
  }

  beforeEach(async () => {
    routeId = null;
    serviceSpy = jasmine.createSpyObj<CourseGroupService>('CourseGroupService', [
      'getById',
      'create',
      'update',
    ]);
    serviceSpy.getById.and.returnValue(of(COURSE_GROUP));
    serviceSpy.create.and.returnValue(of({ ...COURSE_GROUP, pkid: 7 }));
    serviceSpy.update.and.returnValue(of(COURSE_GROUP));
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [CourseGroupForm],
      providers: [
        provideNoopAnimations(),
        { provide: CourseGroupService, useValue: serviceSpy },
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
      component.form.setValue({ description: '雲端技術' });
      component.save();

      expect(serviceSpy.create).toHaveBeenCalledTimes(1);
      const arg = serviceSpy.create.calls.mostRecent().args[0];
      expect(arg.pkid).toBe(0);
      expect(arg.description).toBe('雲端技術');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/course-groups', 7]);
    });
  });

  describe('edit mode', () => {
    it('should load the course group and patch the form', () => {
      const fixture = setup('1');
      const component = fixture.componentInstance;
      expect(component.isEdit()).toBeTrue();
      expect(serviceSpy.getById).toHaveBeenCalledWith(1);
      expect(component.form.controls.description.value).toBe('資訊安全');
    });

    it('should call update() carrying the pkid on save', () => {
      const fixture = setup('1');
      const component = fixture.componentInstance;
      component.form.controls.description.setValue('資訊安全（已編輯）');
      component.save();

      expect(serviceSpy.update).toHaveBeenCalledTimes(1);
      const arg = serviceSpy.update.calls.mostRecent().args[0];
      expect(arg.pkid).toBe(1);
      expect(arg.description).toBe('資訊安全（已編輯）');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/course-groups', 1]);
    });
  });
});
