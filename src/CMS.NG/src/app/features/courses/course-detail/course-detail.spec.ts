import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { QRCodeComponent } from 'angularx-qrcode';
import { of } from 'rxjs';

import { CourseDetail } from './course-detail';
import { CourseService } from '../../../core/services/course.service';
import { PublishStatusService } from '../../../core/services/publish-status.service';
import { Course, LookupItem } from '../../../core/models/course.model';
import { PublishStatus } from '../../../core/models/publish-status.model';

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

/**
 * The three PublishStatus bits are independent (database/course.sql:247-249), so the
 * fixtures cover published, draft and discontinued separately. COURSE.publishStatus_pkid
 * is 1 (published).
 */
const PUBLISH_STATUSES: PublishStatus[] = [
  { pkid: 1, description: '上架中', isDraft: false, isPublished: true, isDiscontinued: false },
  { pkid: 2, description: '草稿', isDraft: true, isPublished: false, isDiscontinued: false },
  { pkid: 3, description: '下架', isDraft: false, isPublished: false, isDiscontinued: true },
  // A published-but-discontinued row: the bits are independent, so this must NOT count as live.
  { pkid: 4, description: '已上架但下架', isDraft: false, isPublished: true, isDiscontinued: true },
];

describe('CourseDetail', () => {
  let fixture: ComponentFixture<CourseDetail>;
  let component: CourseDetail;
  let serviceSpy: jasmine.SpyObj<CourseService>;
  let publishStatusSpy: jasmine.SpyObj<PublishStatusService>;
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

    publishStatusSpy = jasmine.createSpyObj<PublishStatusService>('PublishStatusService', [
      'getAll',
    ]);
    publishStatusSpy.getAll.and.returnValue(of(PUBLISH_STATUSES));

    await TestBed.configureTestingModule({
      imports: [CourseDetail],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CourseService, useValue: serviceSpy },
        { provide: PublishStatusService, useValue: publishStatusSpy },
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

  describe('友善列印', () => {
    /** Rebuild the fixture with the course pointing at a given PublishStatus pkid. */
    function withStatus(publishStatusPkid: number): ComponentFixture<CourseDetail> {
      serviceSpy.getById.and.returnValue(of({ ...COURSE, publishStatus_pkid: publishStatusPkid }));
      const f = TestBed.createComponent(CourseDetail);
      f.detectChanges();
      return f;
    }

    function printButton(f: ComponentFixture<CourseDetail>): HTMLButtonElement {
      const btn = f.debugElement
        .queryAll(By.css('.page-actions button'))
        .find((d) => (d.nativeElement as HTMLElement).textContent?.includes('友善列印'));
      return btn!.nativeElement as HTMLButtonElement;
    }

    it('should be enabled for a published course', () => {
      expect(component.hasPublicPage()).toBeTrue();
      expect(printButton(fixture).disabled).toBeFalse();
    });

    it('should be disabled for a draft course (no public page yet)', () => {
      const f = withStatus(2);
      expect(f.componentInstance.hasPublicPage()).toBeFalse();
      expect(printButton(f).disabled).toBeTrue();
    });

    it('should be disabled for a discontinued course (public page 404s)', () => {
      const f = withStatus(3);
      expect(f.componentInstance.hasPublicPage()).toBeFalse();
      expect(printButton(f).disabled).toBeTrue();
    });

    it('should be disabled when published AND discontinued — the bits are independent', () => {
      const f = withStatus(4);
      expect(f.componentInstance.hasPublicPage()).toBeFalse();
      expect(printButton(f).disabled).toBeTrue();
    });

    it('should be disabled when the status pkid resolves to nothing', () => {
      const f = withStatus(999);
      expect(f.componentInstance.hasPublicPage()).toBeFalse();
    });

    it('should open the public course page in a new tab', () => {
      const open = spyOn(window, 'open');
      component.openPublicPage();
      expect(open).toHaveBeenCalledWith(
        'https://www.uuu.com.tw/Course/Show/1/AZ-900',
        '_blank',
        'noopener',
      );
    });

    it('should not open anything when the course has no public page', () => {
      const open = spyOn(window, 'open');
      withStatus(3).componentInstance.openPublicPage();
      expect(open).not.toHaveBeenCalled();
    });
  });

  describe('QR code', () => {
    it('should encode the public course URL built from pkid and courseId', () => {
      expect(component.qrUrl()).toBe('https://www.uuu.com.tw/Course/Show/1/AZ-900');

      const qr = fixture.debugElement.query(By.directive(QRCodeComponent));
      expect(qr.componentInstance.qrdata).toBe('https://www.uuu.com.tw/Course/Show/1/AZ-900');
    });

    it('should percent-encode a courseId containing URL-unsafe characters', () => {
      serviceSpy.getById.and.returnValue(of({ ...COURSE, pkid: 42, courseId: 'A B/C' }));

      const f = TestBed.createComponent(CourseDetail);
      f.detectChanges();

      expect(f.componentInstance.qrUrl()).toBe('https://www.uuu.com.tw/Course/Show/42/A%20B%2FC');
    });

    it('should show the courseId as the title under the QR code', () => {
      const title: HTMLElement = fixture.nativeElement.querySelector('.qr-panel .qr-title');
      expect(title.textContent?.trim()).toBe('AZ-900');
    });

    /**
     * The QR encodes the public page, which 404s for the 648 of 1084 courses that are not
     * published. A downloadable QR to a dead page is the failure this gate exists to prevent.
     */
    describe('when the course has no public page', () => {
      let f: ComponentFixture<CourseDetail>;

      beforeEach(() => {
        serviceSpy.getById.and.returnValue(of({ ...COURSE, publishStatus_pkid: 3 }));
        f = TestBed.createComponent(CourseDetail);
        f.detectChanges();
      });

      it('should not render the QR code at all', () => {
        expect(f.debugElement.query(By.directive(QRCodeComponent))).toBeNull();
      });

      it('should not render a link to the dead public page', () => {
        expect(f.nativeElement.querySelector('.qr-panel .qr-url')).toBeNull();
      });

      it('should not offer a QR download', () => {
        const buttons = f.debugElement
          .queryAll(By.css('.qr-panel button'))
          .filter((d) => (d.nativeElement as HTMLElement).textContent?.includes('下載 QR Code'));
        expect(buttons.length).toBe(0);
      });

      it('should explain why, and still show the courseId', () => {
        const msg: HTMLElement = f.nativeElement.querySelector('.qr-panel .qr-unavailable');
        expect(msg.textContent).toContain('課程未上架');
        const title: HTMLElement = f.nativeElement.querySelector('.qr-panel .qr-title');
        expect(title.textContent?.trim()).toBe('AZ-900');
      });

      it('should return null from downloadQrCode() with no canvas to read', () => {
        expect(f.componentInstance.downloadQrCode()).toBeNull();
      });
    });

    it('downloadQrCode() should produce a PNG image named after the courseId', () => {
      const link = document.createElement('a');
      const clickSpy = spyOn(link, 'click');
      spyOn(document, 'createElement').and.returnValue(link);

      const dataUrl = component.downloadQrCode();

      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
      expect(link.href).toBe(dataUrl!);
      expect(link.download).toBe('AZ-900.png');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('the downloaded data URL should decode to a non-empty PNG', () => {
      const dataUrl = component.downloadQrCode()!;
      const bytes = atob(dataUrl.split(',')[1]);

      expect(bytes.length).toBeGreaterThan(0);
      // PNG magic number: \x89 P N G
      expect(bytes.slice(0, 4)).toBe('\x89PNG');
    });

    it('should render actual QR modules onto the canvas, not a blank image', () => {
      const canvas: HTMLCanvasElement = fixture.nativeElement.querySelector('.qr-panel canvas');
      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);

      const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      let darkPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 128 && data[i + 3] > 0) darkPixels++;
      }
      // A blank/white canvas has none; a real QR is roughly 30-50% dark modules.
      expect(darkPixels).toBeGreaterThan(canvas.width * canvas.height * 0.1);
    });

    it('downloadQrCode() should be a no-op when the QR canvas has not rendered', () => {
      serviceSpy.getById.and.returnValue(of(COURSE));
      const f = TestBed.createComponent(CourseDetail);
      // No detectChanges() — the QR canvas is never rendered.
      expect(f.componentInstance.downloadQrCode()).toBeNull();
    });
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
