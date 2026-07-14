import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { PartnerForm } from './partner-form';
import { PartnerService } from '../../../core/services/partner.service';
import { Partner } from '../../../core/models/partner.model';

const PARTNER: Partner = {
  pkid: 1,
  name: '微軟',
  appKey: 'MS',
  nameOnPartnerMenu: '微軟認證課程',
  nameOnCourseDetailPage: '微軟',
  displayOrder: 10,
  imageFilename: 'ms.png',
};

describe('PartnerForm', () => {
  let serviceSpy: jasmine.SpyObj<PartnerService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let routeId: string | null;

  function setup(id: string | null): ComponentFixture<PartnerForm> {
    routeId = id;
    const fixture = TestBed.createComponent(PartnerForm);
    fixture.detectChanges(); // triggers ngOnInit
    return fixture;
  }

  beforeEach(async () => {
    routeId = null;
    serviceSpy = jasmine.createSpyObj<PartnerService>('PartnerService', ['getById', 'create', 'update']);
    serviceSpy.getById.and.returnValue(of(PARTNER));
    serviceSpy.create.and.returnValue(of({ ...PARTNER, pkid: 7 }));
    serviceSpy.update.and.returnValue(of(PARTNER));
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [PartnerForm],
      providers: [
        provideNoopAnimations(),
        { provide: PartnerService, useValue: serviceSpy },
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
      component.form.setValue({
        name: '甲骨文',
        appKey: 'ORA',
        nameOnPartnerMenu: '甲骨文課程',
        nameOnCourseDetailPage: '甲骨文',
        displayOrder: 20,
        imageFilename: null,
      });
      component.save();

      expect(serviceSpy.create).toHaveBeenCalledTimes(1);
      const arg = serviceSpy.create.calls.mostRecent().args[0];
      expect(arg.pkid).toBe(0);
      expect(arg.name).toBe('甲骨文');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/partners', 7]);
    });
  });

  describe('edit mode', () => {
    it('should load the partner and patch the form', () => {
      const fixture = setup('1');
      const component = fixture.componentInstance;
      expect(component.isEdit()).toBeTrue();
      expect(serviceSpy.getById).toHaveBeenCalledWith(1);
      expect(component.form.controls.name.value).toBe('微軟');
    });

    it('should call update() carrying the pkid on save', () => {
      const fixture = setup('1');
      const component = fixture.componentInstance;
      component.form.controls.name.setValue('微軟（已編輯）');
      component.save();

      expect(serviceSpy.update).toHaveBeenCalledTimes(1);
      const arg = serviceSpy.update.calls.mostRecent().args[0];
      expect(arg.pkid).toBe(1);
      expect(arg.name).toBe('微軟（已編輯）');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/partners', 1]);
    });
  });
});
