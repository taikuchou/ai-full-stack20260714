import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';

import { CourseGroupService } from '../../../core/services/course-group.service';
import { CourseGroup } from '../../../core/models/course-group.model';

@Component({
  selector: 'app-course-group-detail',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './course-group-detail.html',
  styleUrl: './course-group-detail.scss',
})
export class CourseGroupDetail implements OnInit {
  private readonly service = inject(CourseGroupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly courseGroup = signal<CourseGroup | null>(null);
  readonly loading = signal(true);

  ngOnInit(): void {
    const pkid = Number(this.route.snapshot.paramMap.get('id'));
    this.service.getById(pkid).subscribe({
      next: (courseGroup) => {
        this.courseGroup.set(courseGroup);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  edit(): void {
    const courseGroup = this.courseGroup();
    if (courseGroup) this.router.navigate(['/course-groups', courseGroup.pkid, 'edit']);
  }

  back(): void {
    this.router.navigate(['/course-groups']);
  }
}
