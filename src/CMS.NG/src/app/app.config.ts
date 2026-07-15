import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    // Root MessageService, backing the app shell's <p-toast />. Pages that provide their own
    // MessageService get a separate instance for their own toasts; this one is for errorInterceptor.
    MessageService,
    providePrimeNG({
      theme: {
        preset: Aura,
        // Dark mode only when `.app-dark` is present; keeps the default light look of the UI sample.
        options: { darkModeSelector: '.app-dark' },
      },
    }),
  ],
};
