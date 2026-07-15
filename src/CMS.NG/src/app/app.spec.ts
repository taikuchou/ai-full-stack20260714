import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { AuthProfile } from './core/models/auth.model';

describe('App', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  function configure(profile: AuthProfile | null): void {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['hasRole', 'logout'], {
      profile: signal(profile),
    });
    authServiceSpy.hasRole.and.callFake((role: string) => profile?.roles.includes(role) ?? false);
  }

  async function setup(profile: AuthProfile | null) {
    configure(profile);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        // The shell hosts the app-level <p-toast /> that errorInterceptor writes to.
        MessageService,
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();
    return TestBed.createComponent(App);
  }

  const ADMIN_PROFILE: AuthProfile = {
    userId: 'helen',
    userName: 'Helen Chen',
    accessToken: 'a.b.c',
    roles: ['Admin'],
  };
  const EDITOR_PROFILE: AuthProfile = {
    userId: 'miles',
    userName: 'Miles Sun',
    accessToken: 'x.y.z',
    roles: ['Editor'],
  };

  it('should create the app', async () => {
    const fixture = await setup(ADMIN_PROFILE);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the CMS brand and the AppRole nav item for an Admin user', async () => {
    const fixture = await setup(ADMIN_PROFILE);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.topbar .logo-text')?.textContent).toContain('CMS');
    expect(compiled.textContent).toContain('角色 AppRole');
  });

  it('should show the signed-in userName in the topbar', async () => {
    const fixture = await setup(ADMIN_PROFILE);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.topbar-username')?.textContent).toContain('Helen Chen');
  });

  it('should hide the 系統管理 Admin nav item for a non-Admin user', async () => {
    const fixture = await setup(EDITOR_PROFILE);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('系統管理 Admin');
    expect(compiled.textContent).not.toContain('角色 AppRole');
  });

  // Logout moved from a standalone topbar icon into the avatar dropdown when My Profile was added.
  it('should call AuthService.logout() from the user menu', async () => {
    const fixture = await setup(ADMIN_PROFILE);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    const logout = app['userMenuItems'].find((i) => i.label?.includes('登出'));
    logout!.command!({} as never);

    expect(authServiceSpy.logout).toHaveBeenCalledTimes(1);
  });

  it('should offer My Profile in the user menu for any signed-in user', async () => {
    // Non-Admin on purpose: the profile page is not role-gated the way the Admin nav item is.
    const fixture = await setup(EDITOR_PROFILE);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    const profileItem = app['userMenuItems'].find((i) => i.label?.includes('My Profile'));
    expect(profileItem).toBeTruthy();
    expect(profileItem!.routerLink).toBe('/profile');
  });

  it('should open the user menu from the avatar button', async () => {
    const fixture = await setup(ADMIN_PROFILE);
    fixture.detectChanges();
    const avatar = fixture.nativeElement.querySelector(
      '[aria-label="使用者選單"]',
    ) as HTMLButtonElement;

    expect(avatar).toBeTruthy();
    expect(avatar.textContent).toContain('H');
  });

  it('should toggle the sidebar collapsed state', async () => {
    const fixture = await setup(ADMIN_PROFILE);
    const app = fixture.componentInstance;
    expect(app['collapsed']()).toBeFalse();
    app.toggleCollapse();
    expect(app['collapsed']()).toBeTrue();
  });
});
