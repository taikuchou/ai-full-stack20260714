// Development environment (used by `ng serve`). API served by CMS.API on port 5000.
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5000/api',
  /** Login disabled locally. Pair with `Auth:Disabled: true` in the API's appsettings.Development.json. */
  authDisabled: true,
};
