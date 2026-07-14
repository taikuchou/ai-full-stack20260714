import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';

import { PartnerService } from '../../../core/services/partner.service';
import { Partner } from '../../../core/models/partner.model';

@Component({
  selector: 'app-partner-detail',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './partner-detail.html',
  styleUrl: './partner-detail.scss',
})
export class PartnerDetail implements OnInit {
  private readonly service = inject(PartnerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly partner = signal<Partner | null>(null);
  readonly loading = signal(true);

  ngOnInit(): void {
    const pkid = Number(this.route.snapshot.paramMap.get('id'));
    this.service.getById(pkid).subscribe({
      next: (partner) => {
        this.partner.set(partner);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  edit(): void {
    const partner = this.partner();
    if (partner) this.router.navigate(['/partners', partner.pkid, 'edit']);
  }

  back(): void {
    this.router.navigate(['/partners']);
  }
}
