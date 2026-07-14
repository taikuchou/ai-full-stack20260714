import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ConfirmationService } from 'primeng/api';
import { of } from 'rxjs';

import { PublishStatusList } from './publish-status-list';
import { PublishStatusService } from '../../../core/services/publish-status.service';
import { PublishStatus } from '../../../core/models/publish-status.model';

const STATUSES: PublishStatus[] = [
  { pkid: 1, description: '草稿', isDraft: true, isPublished: false, isDiscontinued: false },
  { pkid: 2, description: '已發布', isDraft: false, isPublished: true, isDiscontinued: false },
];

describe('PublishStatusList', () => {
  let fixture: ComponentFixture<PublishStatusList>;
  let component: PublishStatusList;
  let serviceSpy: jasmine.SpyObj<PublishStatusService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<PublishStatusService>('PublishStatusService', ['query', 'delete']);
    serviceSpy.query.and.returnValue(of(STATUSES));
    serviceSpy.delete.and.returnValue(of(void 0));
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [PublishStatusList],
      providers: [
        provideNoopAnimations(),
        { provide: PublishStatusService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    sessionStorage.clear();
    fixture = TestBed.createComponent(PublishStatusList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load statuses via query() on init', () => {
    expect(serviceSpy.query).toHaveBeenCalledTimes(1);
    expect(component.statuses().length).toBe(2);
  });

  it('applyFilter() should persist filters to sessionStorage and reload', () => {
    component.filter.keyword = '草稿';
    component.applyFilter();

    const saved = JSON.parse(sessionStorage.getItem('publish-status-list-filters')!);
    expect(saved.keyword).toBe('草稿');
    expect(serviceSpy.query).toHaveBeenCalledTimes(2);
  });

  it('add() should navigate to the new route', () => {
    component.add();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/publish-statuses/new']);
  });

  it('confirmDelete() should ask for confirmation and delete on accept', () => {
    const confirmationService = fixture.debugElement.injector.get(ConfirmationService);
    const confirmSpy = spyOn(confirmationService, 'confirm').and.callFake((opts: any) => {
      opts.accept();
      return confirmationService;
    });

    component.confirmDelete(STATUSES[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(serviceSpy.delete).toHaveBeenCalledWith(1);
  });
});
