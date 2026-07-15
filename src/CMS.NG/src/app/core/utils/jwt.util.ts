// AuthController issues tokens with claims built from System.Security.Claims.ClaimTypes, whose
// values are long XML-namespace URIs, not the short JWT-registered names. Role claims land under
// this key, either as a single string or (when a user has multiple roles) a JSON string array.
//
// Note the namespace: .NET's ClaimTypes.Role is the *microsoft.com/ws/2008/06* URI, while its
// NameIdentifier/Name siblings are *xmlsoap.org/ws/2005/05*. Role is the odd one out. Getting this
// wrong is silent — decodeJwtRoles just returns [] and every hasRole() check reads false.
export const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

/** Decodes a JWT's payload without verifying its signature (verification is the API's job). */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  if (!payload) return {};

  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

/** Extracts role claims from a JWT access token. Returns [] if the token is malformed or roleless. */
export function decodeJwtRoles(token: string): string[] {
  let payload: Record<string, unknown>;
  try {
    payload = decodeJwtPayload(token);
  } catch {
    return [];
  }

  const roles = payload[ROLE_CLAIM];
  if (Array.isArray(roles)) return roles.filter((r): r is string => typeof r === 'string');
  if (typeof roles === 'string') return [roles];
  return [];
}
