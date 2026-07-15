// Default (production) environment. Replaced by environment.development.ts for `ng serve`.
export const environment = {
  production: true,
  apiBaseUrl: 'http://localhost:5000/api',
  /**
   * Bypass the login screen and let authGuard through. Development only — must stay false here,
   * and the API needs its own `Auth:Disabled` set to match, or every request still 401s.
   */
  authDisabled: false,
};
