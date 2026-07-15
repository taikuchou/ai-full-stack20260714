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
