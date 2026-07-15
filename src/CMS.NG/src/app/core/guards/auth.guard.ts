import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { environment } from '@env/environment';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  // Development escape hatch: let every route through without a token. The API must have
  // `Auth:Disabled` set to match, otherwise the requests behind these routes still 401.
  if (environment.authDisabled) return true;

  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAuthenticated() ? true : router.createUrlTree(['/login']);
};
