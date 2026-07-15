import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
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
      providers: [provideRouter(routes), { provide: AuthService, useValue: authServiceSpy }],
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

  it('should call AuthService.logout() when the logout button is clicked', async () => {
    const fixture = await setup(ADMIN_PROFILE);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('[aria-label="登出"]') as HTMLButtonElement;
    button.click();
    expect(authServiceSpy.logout).toHaveBeenCalledTimes(1);
  });

  it('should toggle the sidebar collapsed state', async () => {
    const fixture = await setup(ADMIN_PROFILE);
    const app = fixture.componentInstance;
    expect(app['collapsed']()).toBeFalse();
    app.toggleCollapse();
    expect(app['collapsed']()).toBeTrue();
  });
});
