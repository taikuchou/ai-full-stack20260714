import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

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
function buildSections(): NavSection[] {
  const systemItems: NavItem[] = [
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
  ];

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
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly collapsed = signal(false);
  protected readonly sections = signal<NavSection[]>(buildSections());

  toggleCollapse(): void {
    this.collapsed.update((c) => !c);
  }

  toggleItem(item: NavItem): void {
    if (item.children) item.expanded = !item.expanded;
  }
}
