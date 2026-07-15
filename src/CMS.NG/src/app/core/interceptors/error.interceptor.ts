import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';

/**
 * Surfaces server-side failures (500-class, and a dead/unreachable API) as a friendly toast, so a
 * request that blows up is never silently swallowed by a page that only handles its happy path.
 *
 * Renders through the **root** MessageService and the app shell's `<p-toast />`, not the
 * component-level MessageService a page may provide for its own save/load toasts.
 *
 * Deliberate responses are left alone: 401 is the auth interceptor's job (it redirects to Login),
 * and 400/403/404 are answers a page is expected to handle itself. The error is always rethrown —
 * this only adds the toast.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const messageService = inject(MessageService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // status 0 = the request never reached the API (offline, CORS, connection refused).
      if (error.status >= 500 || error.status === 0) {
        messageService.add({
          severity: 'error',
          summary: '系統錯誤 Server error',
          detail: '操作未完成，請稍後再試。The request could not be completed.',
          life: 6000,
        });
      }
      return throwError(() => error);
    }),
  );
};
