import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
    return TestBed.createComponent(App);
  }

  it('should create the app', async () => {
    const fixture = await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the CMS brand and the AppRole nav item', async () => {
    const fixture = await setup();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.topbar .logo-text')?.textContent).toContain('CMS');
    expect(compiled.textContent).toContain('角色 AppRole');
  });

  it('should show the 系統管理 Admin nav section', async () => {
    // No auth, so no role gate — the section is always present.
    const fixture = await setup();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('系統管理 Admin');
  });

  it('should toggle the sidebar collapsed state', async () => {
    const fixture = await setup();
    const app = fixture.componentInstance;
    expect(app['collapsed']()).toBeFalse();
    app.toggleCollapse();
    expect(app['collapsed']()).toBeTrue();
  });
});
