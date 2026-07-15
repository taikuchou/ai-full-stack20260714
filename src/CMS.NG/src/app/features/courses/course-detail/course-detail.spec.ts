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
import { Course, LookupItem } from '../../../core/models/course.model';

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

describe('CourseDetail', () => {
  let fixture: ComponentFixture<CourseDetail>;
  let component: CourseDetail;
  let serviceSpy: jasmine.SpyObj<CourseService>;
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

    await TestBed.configureTestingModule({
      imports: [CourseDetail],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CourseService, useValue: serviceSpy },
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
