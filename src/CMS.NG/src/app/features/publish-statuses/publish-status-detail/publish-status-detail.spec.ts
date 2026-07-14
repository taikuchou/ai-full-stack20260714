import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { PublishStatusDetail } from './publish-status-detail';
import { PublishStatusService } from '../../../core/services/publish-status.service';
import { PublishStatus } from '../../../core/models/publish-status.model';

const STATUS: PublishStatus = {
  pkid: 1,
  description: '草稿',
  isDraft: true,
  isPublished: false,
  isDiscontinued: false,
};

describe('PublishStatusDetail', () => {
  let fixture: ComponentFixture<PublishStatusDetail>;
  let component: PublishStatusDetail;
  let serviceSpy: jasmine.SpyObj<PublishStatusService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<PublishStatusService>('PublishStatusService', ['getById']);
    serviceSpy.getById.and.returnValue(of(STATUS));
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [PublishStatusDetail],
      providers: [
        provideNoopAnimations(),
        { provide: PublishStatusService, useValue: serviceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: (_: string) => '1' } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublishStatusDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load the status by numeric pkid on init', () => {
    expect(serviceSpy.getById).toHaveBeenCalledWith(1);
    expect(component.status()?.description).toBe('草稿');
    expect(component.loading()).toBeFalse();
  });

  it('edit() should navigate to the edit route', () => {
    component.edit();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/publish-statuses', 1, 'edit']);
  });

  it('back() should navigate to the list', () => {
    component.back();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/publish-statuses']);
  });
});
