import { decodeJwtRoles, ROLE_CLAIM } from './jwt.util';

function fakeToken(payload: Record<string, unknown>): string {
  const base64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_');
  return `header.${base64}.signature`;
}

describe('decodeJwtRoles', () => {
  it('returns a single-role array when the role claim is a string', () => {
    const token = fakeToken({ [ROLE_CLAIM]: 'Admin' });
    expect(decodeJwtRoles(token)).toEqual(['Admin']);
  });

  it('returns all roles when the role claim is an array', () => {
    const token = fakeToken({ [ROLE_CLAIM]: ['Admin', 'Editor'] });
    expect(decodeJwtRoles(token)).toEqual(['Admin', 'Editor']);
  });

  it('returns [] when there is no role claim', () => {
    const token = fakeToken({ sub: 'helen' });
    expect(decodeJwtRoles(token)).toEqual([]);
  });

  it('returns [] for a malformed token', () => {
    expect(decodeJwtRoles('not-a-jwt')).toEqual([]);
  });
});

/**
 * Every test above builds its token from ROLE_CLAIM itself, so they stay green even if the constant
 * does not match what the API actually issues — which is exactly how the wrong URI survived here.
 * These pin it against reality instead.
 */
describe('ROLE_CLAIM matches the token the API really issues', () => {
  // Captured verbatim from JwtTokenGenerator.Generate("helen", "Helen Chen", ["Admin"], ...).
  // Regenerate with a probe against the real generator if the backend's claim types ever change.
  // prettier-ignore
  const REAL_API_PAYLOAD = 'eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6ImhlbGVuIiwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvd3MvMjAwNS8wNS9pZGVudGl0eS9jbGFpbXMvbmFtZSI6IkhlbGVuIENoZW4iLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJBZG1pbiIsIm5iZiI6MTc4NDA5NDcwMiwiZXhwIjoxNzg0MDk4MzAyfQ';
  const REAL_API_TOKEN = `header.${REAL_API_PAYLOAD}.signature`;

  it('decodes the roles out of a token the backend actually produced', () => {
    expect(decodeJwtRoles(REAL_API_TOKEN)).toEqual(['Admin']);
  });

  it('is the microsoft.com/2008/06 role URI, not the xmlsoap.org/2005/05 one', () => {
    // .NET's ClaimTypes.Role sits in a different namespace from ClaimTypes.Name /
    // ClaimTypes.NameIdentifier. Mixing them up silently yields no roles at all.
    expect(ROLE_CLAIM).toBe('http://schemas.microsoft.com/ws/2008/06/identity/claims/role');
  });
});
