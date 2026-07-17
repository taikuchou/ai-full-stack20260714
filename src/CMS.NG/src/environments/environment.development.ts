// Development environment (used by `ng serve`). API served by CMS.API on port 5000.
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5000/api',
  /**
   * Login is ENFORCED locally. The escape hatch remains available: set this to true to bypass the
   * login screen, and pair it with `Auth:Disabled: true` in the API's appsettings.Development.json
   * or every request behind those routes still 401s.
   */
  authDisabled: false,
};
