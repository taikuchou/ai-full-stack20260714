import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { TagModule } from 'primeng/tag';

import { CourseService } from '../../../core/services/course.service';
import { Course, LookupItem } from '../../../core/models/course.model';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, ChipModule, TagModule],
  templateUrl: './course-detail.html',
  styleUrl: './course-detail.scss',
})
export class CourseDetail implements OnInit {
  private readonly service = inject(CourseService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly course = signal<Course | null>(null);
  readonly certificationLabels = signal<string[]>([]);
  readonly jobCategoryLabels = signal<string[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    const pkid = Number(this.route.snapshot.paramMap.get('id'));
    forkJoin({
      course: this.service.getById(pkid),
      certifications: this.service.getCertifications(),
      jobCategories: this.service.getJobCategories(),
    }).subscribe({
      next: ({ course, certifications, jobCategories }) => {
        this.course.set(course);
        this.certificationLabels.set(this.resolve(course.certificationPkids, certifications));
        this.jobCategoryLabels.set(this.resolve(course.jobCategoryPkids, jobCategories));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private resolve(ids: number[], options: LookupItem[]): string[] {
    const byId = new Map(options.map((o) => [o.id, o.label]));
    return ids.map((id) => byId.get(String(id)) ?? String(id));
  }

  edit(): void {
    const course = this.course();
    if (course) this.router.navigate(['/courses', course.pkid, 'edit']);
  }

  back(): void {
    this.router.navigate(['/courses']);
  }
}
