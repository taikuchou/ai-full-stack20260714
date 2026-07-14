import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService } from 'primeng/api';
import { of } from 'rxjs';

import { PartnerList } from './partner-list';
import { PartnerService } from '../../../core/services/partner.service';
import { Partner } from '../../../core/models/partner.model';

const PARTNERS: Partner[] = [
  {
    pkid: 1,
    name: '微軟',
    appKey: 'MS',
    nameOnPartnerMenu: '微軟認證課程',
    nameOnCourseDetailPage: '微軟',
    displayOrder: 10,
    imageFilename: 'ms.png',
  },
  {
    pkid: 2,
    name: '甲骨文',
    appKey: 'ORA',
    nameOnPartnerMenu: '甲骨文課程',
    nameOnCourseDetailPage: '甲骨文',
    displayOrder: 20,
    imageFilename: null,
  },
];

describe('PartnerList', () => {
  let fixture: ComponentFixture<PartnerList>;
  let component: PartnerList;
  let serviceSpy: jasmine.SpyObj<PartnerService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<PartnerService>('PartnerService', ['query', 'delete']);
    serviceSpy.query.and.returnValue(of(PARTNERS));
    serviceSpy.delete.and.returnValue(of(void 0));
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [PartnerList],
      providers: [
        provideNoopAnimations(),
        { provide: PartnerService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    sessionStorage.clear();
    fixture = TestBed.createComponent(PartnerList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load partners via query() on init', () => {
    expect(serviceSpy.query).toHaveBeenCalledTimes(1);
    expect(component.partners().length).toBe(2);
  });

  it('applyFilter() should persist filters to sessionStorage and reload', () => {
    component.filter.keyword = '微軟';
    component.applyFilter();

    const saved = JSON.parse(sessionStorage.getItem('partner-list-filters')!);
    expect(saved.keyword).toBe('微軟');
    expect(serviceSpy.query).toHaveBeenCalledTimes(2);
  });

  it('add() should navigate to the new route', () => {
    component.add();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/partners/new']);
  });

  it('confirmDelete() should ask for confirmation and delete on accept', () => {
    const confirmationService = fixture.debugElement.injector.get(ConfirmationService);
    const confirmSpy = spyOn(confirmationService, 'confirm').and.callFake((opts: any) => {
      opts.accept();
      return confirmationService;
    });

    component.confirmDelete(PARTNERS[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(serviceSpy.delete).toHaveBeenCalledWith(1);
  });
});
