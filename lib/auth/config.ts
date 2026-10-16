export const SESSION_COOKIE_NAME = 'finance_session';
export const SESSION_DURATION_SECONDS = 60 * 60 * 12;

const PASSWORD_HASH_PATTERN = /^scrypt\$[A-Za-z0-9_-]{22}\$[a-f0-9]{128}$/;

export function isPasswordHash(value: string | undefined): value is string {
  return !!value && PASSWORD_HASH_PATTERN.test(value);
}

export function isAuthConfigured(): boolean {
  const sessionSecret =
    process.env.AUTH_SESSION_SECRET ||
    (process.env.NODE_ENV !== 'production'
      ? 'finance-session-secret-key-at-least-32-chars!'
      : undefined);

  return !!sessionSecret && new TextEncoder().encode(sessionSecret).length >= 32;
}

export function getSessionSecret(): string {
  const sessionSecret =
    process.env.AUTH_SESSION_SECRET ||
    (process.env.NODE_ENV !== 'production'
      ? 'finance-session-secret-key-at-least-32-chars!'
      : undefined);

  if (!sessionSecret || new TextEncoder().encode(sessionSecret).length < 32) {
    throw new Error('AUTH_SESSION_SECRET must contain at least 32 bytes.');
  }

  return sessionSecret;
}
