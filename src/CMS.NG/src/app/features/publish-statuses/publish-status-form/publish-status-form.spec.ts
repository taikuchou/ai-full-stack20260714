import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { PublishStatusForm } from './publish-status-form';
import { PublishStatusService } from '../../../core/services/publish-status.service';
import { PublishStatus } from '../../../core/models/publish-status.model';

const DRAFT: PublishStatus = {
  pkid: 1,
  description: '草稿',
  isDraft: true,
  isPublished: false,
  isDiscontinued: false,
};

describe('PublishStatusForm', () => {
  let serviceSpy: jasmine.SpyObj<PublishStatusService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let routeId: string | null;

  function setup(id: string | null): ComponentFixture<PublishStatusForm> {
    routeId = id;
    const fixture = TestBed.createComponent(PublishStatusForm);
    fixture.detectChanges(); // triggers ngOnInit
    return fixture;
  }

  beforeEach(async () => {
    routeId = null;
    serviceSpy = jasmine.createSpyObj<PublishStatusService>('PublishStatusService', [
      'getById',
      'create',
      'update',
    ]);
    serviceSpy.getById.and.returnValue(of(DRAFT));
    serviceSpy.create.and.returnValue(of(DRAFT));
    serviceSpy.update.and.returnValue(of(DRAFT));
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [PublishStatusForm],
      providers: [
        provideNoopAnimations(),
        { provide: PublishStatusService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (_: string) => routeId } } },
        },
      ],
    }).compileComponents();
  });

  describe('add mode', () => {
    it('should be in add mode with pkid enabled', () => {
      const fixture = setup(null);
      const component = fixture.componentInstance;
      expect(component.isEdit()).toBeFalse();
      expect(component.form.controls.pkid.disabled).toBeFalse();
      expect(serviceSpy.getById).not.toHaveBeenCalled();
    });

    it('should not call create() when the form is invalid (missing description)', () => {
      const fixture = setup(null);
      // pkid defaults to 0 (valid) but description is empty → invalid.
      fixture.componentInstance.save();
      expect(serviceSpy.create).not.toHaveBeenCalled();
    });

    it('should call create() with the form values when valid', () => {
      const fixture = setup(null);
      const component = fixture.componentInstance;
      component.form.setValue({
        pkid: 5,
        description: '已發布',
        isDraft: false,
        isPublished: true,
        isDiscontinued: false,
      });
      component.save();

      expect(serviceSpy.create).toHaveBeenCalledTimes(1);
      const arg = serviceSpy.create.calls.mostRecent().args[0];
      expect(arg.pkid).toBe(5);
      expect(arg.isPublished).toBeTrue();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/publish-statuses', 5]);
    });
  });

  describe('edit mode', () => {
    it('should load the status, patch the form and disable pkid', () => {
      const fixture = setup('1');
      const component = fixture.componentInstance;
      expect(component.isEdit()).toBeTrue();
      expect(serviceSpy.getById).toHaveBeenCalledWith(1);
      expect(component.form.controls.description.value).toBe('草稿');
      expect(component.form.controls.pkid.disabled).toBeTrue();
    });

    it('should call update() (including the disabled pkid) on save', () => {
      const fixture = setup('1');
      const component = fixture.componentInstance;
      component.form.controls.description.setValue('草稿（已編輯）');
      component.save();

      expect(serviceSpy.update).toHaveBeenCalledTimes(1);
      const arg = serviceSpy.update.calls.mostRecent().args[0];
      expect(arg.pkid).toBe(1);
      expect(arg.description).toBe('草稿（已編輯）');
    });
  });
});
