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

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly collapsed = signal(false);

  // Ultima-style grouped menu: uppercase section headers → items → optional children.
  protected readonly sections = signal<NavSection[]>([
    {
      header: '選單 Menu',
      items: [
        { label: '首頁管理 Home', icon: 'pi pi-home' },
        { label: '課程管理 Course', icon: 'pi pi-folder' },
        { label: '說明會 Seminar', icon: 'pi pi-comments' },
        { label: '活動管理 Promotion', icon: 'pi pi-megaphone' },
        { label: '線上報名 Forms', icon: 'pi pi-file-edit' },
        { label: '網站資訊 WebInfo', icon: 'pi pi-globe' },
        { label: '考試中心 TestingCenter', icon: 'pi pi-verified' },
      ],
    },
    {
      header: '系統 System',
      items: [
        {
          label: '系統管理 Admin',
          icon: 'pi pi-shield',
          expanded: true,
          children: [
            { label: '角色 AppRole', icon: 'pi pi-id-card', route: '/app-roles' },
            { label: '使用者 AppUser', icon: 'pi pi-user', route: '/app-users' },
          ],
        },
      ],
    },
  ]);

  toggleCollapse(): void {
    this.collapsed.update((c) => !c);
  }

  toggleItem(item: NavItem): void {
    if (item.children) item.expanded = !item.expanded;
  }
}
