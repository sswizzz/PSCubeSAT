export const AUTH_EXPIRED_EVENT = 'ptit:auth-expired';

// Only used for client expiry scheduling after server verification, never as proof of identity.
export function tokenExpiresAt(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(part));
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp * 1000 : null;
  } catch { return null; }
}

export function loginDestination(value) {
  if (typeof value !== 'string' || !/^\/(?:lab[0-8]|profile|preview|classes(?:\/[1-9]\d*(?:\/(?:curriculum|learn|path|progress|labs\/[0-8]\/questions))?)?|admin\/(?:dashboard|users))?(?:\?|#|$)/.test(value)) return '/';
  return value;
}

