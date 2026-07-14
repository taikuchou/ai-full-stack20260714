import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { PartnerDetail } from './partner-detail';
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

describe('PartnerDetail', () => {
  let fixture: ComponentFixture<PartnerDetail>;
  let component: PartnerDetail;
  let serviceSpy: jasmine.SpyObj<PartnerService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<PartnerService>('PartnerService', ['getById']);
    serviceSpy.getById.and.returnValue(of(PARTNER));
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [PartnerDetail],
      providers: [
        provideNoopAnimations(),
        { provide: PartnerService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: (_: string) => '1' } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PartnerDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load the partner by numeric pkid on init', () => {
    expect(serviceSpy.getById).toHaveBeenCalledWith(1);
    expect(component.partner()?.name).toBe('微軟');
    expect(component.loading()).toBeFalse();
  });

  it('edit() should navigate to the edit route', () => {
    component.edit();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/partners', 1, 'edit']);
  });

  it('back() should navigate to the list', () => {
    component.back();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/partners']);
  });
});
