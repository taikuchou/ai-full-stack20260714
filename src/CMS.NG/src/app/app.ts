import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';
import { filter } from 'rxjs';

import { AuthService } from './core/services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route?: string;
  children?: NavItem[];
  expanded?: boolean;
}
interface NavSection {
  header: string;
  items: NavItem[];
}

// Ultima-style grouped menu: uppercase section headers → items → optional children.
// The "系統管理 Admin" item is only included for users whose roles include "Admin".
function buildSections(isAdmin: boolean): NavSection[] {
  const systemItems: NavItem[] = isAdmin
    ? [
        {
          label: '系統管理 Admin',
          icon: 'pi pi-shield',
          expanded: true,
          children: [
            { label: '角色 AppRole', icon: 'pi pi-id-card', route: '/app-roles' },
            { label: '使用者 AppUser', icon: 'pi pi-user', route: '/app-users' },
            { label: '發布狀態 PublishStatus', icon: 'pi pi-flag', route: '/publish-statuses' },
          ],
        },
      ]
    : [];

  return [
    {
      header: '選單 Menu',
      items: [
        {
          label: '首頁管理 Home',
          icon: 'pi pi-home',
          expanded: true,
          children: [
            {
              label: '上稿作業 FeaturedPromoItem',
              icon: 'pi pi-calendar',
              route: '/featured-promo-items',
            },
          ],
        },
        {
          label: '課程管理 Course',
          icon: 'pi pi-folder',
          expanded: true,
          children: [
            { label: '課程 Course', icon: 'pi pi-book', route: '/courses' },
            { label: '合作廠商 Partner', icon: 'pi pi-building', route: '/partners' },
            { label: '課程群組 CourseGroup', icon: 'pi pi-sitemap', route: '/course-groups' },
          ],
        },
        { label: '說明會 Seminar', icon: 'pi pi-comments' },
        { label: '活動管理 Promotion', icon: 'pi pi-megaphone' },
        { label: '線上報名 Forms', icon: 'pi pi-file-edit' },
        { label: '網站資訊 WebInfo', icon: 'pi pi-globe' },
        { label: '考試中心 TestingCenter', icon: 'pi pi-verified' },
      ],
    },
    {
      header: '系統 System',
      items: systemItems,
    },
  ];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MenuModule, ToastModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Below the mobile breakpoint the sidebar is an overlay (see app.scss), so it starts closed.
  protected readonly collapsed = signal(window.innerWidth < 992);
  protected readonly isLoginPage = signal(this.router.url.startsWith('/login'));

  protected readonly sections = computed<NavSection[]>(() =>
    buildSections(this.authService.hasRole('Admin')),
  );

  // Avatar dropdown. Available to every signed-in user regardless of role.
  protected readonly userMenuItems: MenuItem[] = [
    {
      label: '個人資料 My Profile',
      icon: 'pi pi-user',
      routerLink: '/profile',
    },
    { separator: true },
    {
      label: '登出 Logout',
      icon: 'pi pi-sign-out',
      command: () => this.logout(),
    },
  ];

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.isLoginPage.set(this.router.url.startsWith('/login'));
    });
  }

  toggleCollapse(): void {
    this.collapsed.update((c) => !c);
  }

  toggleItem(item: NavItem): void {
    if (item.children) item.expanded = !item.expanded;
  }

  logout(): void {
    this.authService.logout();
  }
}
