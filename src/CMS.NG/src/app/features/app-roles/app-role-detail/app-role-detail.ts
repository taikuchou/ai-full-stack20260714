import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';

import { AppRoleService } from '../../../core/services/app-role.service';
import { AppRole, LookupItem } from '../../../core/models/app-role.model';
import { RowAuditBadge } from '../../../core/components/row-audit-badge/row-audit-badge';

@Component({
  selector: 'app-app-role-detail',
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule, ChipModule, RowAuditBadge],
  templateUrl: './app-role-detail.html',
  styleUrl: './app-role-detail.scss',
})
export class AppRoleDetail implements OnInit {
  private readonly service = inject(AppRoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly role = signal<AppRole | null>(null);
  readonly userLabels = signal<string[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    const roleId = this.route.snapshot.paramMap.get('id')!;
    forkJoin({
      role: this.service.getById(roleId),
      users: this.service.getAppUsers(),
    }).subscribe({
      next: ({ role, users }) => {
        this.role.set(role);
        this.userLabels.set(this.resolveUserLabels(role.userIds, users));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private resolveUserLabels(userIds: string[], users: LookupItem[]): string[] {
    const byId = new Map(users.map((u) => [u.id, u.label]));
    return userIds.map((id) => byId.get(id) ?? id);
  }

  edit(): void {
    const role = this.role();
    if (role) this.router.navigate(['/app-roles', role.roleId, 'edit']);
  }

  back(): void {
    this.router.navigate(['/app-roles']);
  }
}
