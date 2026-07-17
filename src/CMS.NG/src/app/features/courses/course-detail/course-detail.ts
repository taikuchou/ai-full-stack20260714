import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { QRCodeComponent } from 'angularx-qrcode';

import { CourseService } from '../../../core/services/course.service';
import { PublishStatusService } from '../../../core/services/publish-status.service';
import { Course, LookupItem } from '../../../core/models/course.model';
import { RowAuditBadge } from '../../../core/components/row-audit-badge/row-audit-badge';

/** Public course page the QR code points at, and the 友善列印 button opens. */
const COURSE_PAGE_BASE_URL = 'https://www.uuu.com.tw/Course/Show';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ButtonModule,
    ChipModule,
    TagModule,
    TooltipModule,
    QRCodeComponent,
    RowAuditBadge,
  ],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss',
})
export class CourseDetail implements OnInit {
  private readonly service = inject(CourseService);
  private readonly publishStatusService = inject(PublishStatusService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly qrCode = viewChild(QRCodeComponent);

  readonly course = signal<Course | null>(null);
  readonly certificationLabels = signal<string[]>([]);
  readonly jobCategoryLabels = signal<string[]>([]);
  readonly loading = signal(true);

  /** Public URL for this course, encoded into the QR code. Empty until the course loads. */
  readonly qrUrl = computed(() => {
    const c = this.course();
    return c ? `${COURSE_PAGE_BASE_URL}/${c.pkid}/${encodeURIComponent(c.courseId)}` : '';
  });

  /**
   * Whether this course has a live public page — the only place 友善列印 exists.
   *
   * The Course DTO carries `publishStatus_pkid` but not the status bits, and
   * /api/lookups/publish-statuses returns {Id,Label} only, so the flags are resolved from
   * the full-entity endpoint by pkid. `isDiscontinued` matters independently of
   * `isPublished`: the bits are independent, and a discontinued course's public page
   * redirects to /Error/ResourceNotFound.
   */
  readonly hasPublicPage = signal(false);

  ngOnInit(): void {
    const pkid = Number(this.route.snapshot.paramMap.get('id'));
    forkJoin({
      course: this.service.getById(pkid),
      certifications: this.service.getCertifications(),
      jobCategories: this.service.getJobCategories(),
      publishStatuses: this.publishStatusService.getAll(),
    }).subscribe({
      next: ({ course, certifications, jobCategories, publishStatuses }) => {
        this.course.set(course);
        this.certificationLabels.set(this.resolve(course.certificationPkids, certifications));
        this.jobCategoryLabels.set(this.resolve(course.jobCategoryPkids, jobCategories));
        const status = publishStatuses.find((s) => s.pkid === course.publishStatus_pkid);
        this.hasPublicPage.set(!!status?.isPublished && !status.isDiscontinued);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private resolve(ids: number[], options: LookupItem[]): string[] {
    const byId = new Map(options.map((o) => [o.id, o.label]));
    return ids.map((id) => byId.get(String(id)) ?? String(id));
  }

  /**
   * Save the rendered QR code as a PNG named after the course's 簡介代碼.
   * Returns the data URL that was downloaded, or null if the canvas is not rendered yet.
   */
  downloadQrCode(): string | null {
    const course = this.course();
    const canvas: HTMLCanvasElement | null =
      this.qrCode()?.qrcElement.nativeElement.querySelector('canvas') ?? null;
    if (!course || !canvas) return null;

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${course.courseId}.png`;
    link.click();
    return dataUrl;
  }

  /**
   * Open the course's public page, where the site's 友善列印 button produces the
   * printer-friendly document. The CMS deliberately does not render its own printable
   * sheet: the public page already carries the recipient-facing content contract and a
   * purpose-built print stylesheet. See TODOS.md › Course sheet.
   */
  openPublicPage(): void {
    const url = this.qrUrl();
    if (url && this.hasPublicPage()) window.open(url, '_blank', 'noopener');
  }

  edit(): void {
    const course = this.course();
    if (course) this.router.navigate(['/courses', course.pkid, 'edit']);
  }

  back(): void {
    this.router.navigate(['/courses']);
  }
}
