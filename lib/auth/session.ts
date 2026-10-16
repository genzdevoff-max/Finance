import {
  getSessionSecret,
  isAuthConfigured,
  SESSION_DURATION_SECONDS,
} from './config';

const encoder = new TextEncoder();

export interface SessionData {
  sub: string;
  uid?: string;
  exp: number;
}

function toBase64Url(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function getSigningKey(): Promise<CryptoKey> {
  const secret = getSessionSecret();

  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSessionToken(username: string, userId?: string): Promise<string> {
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify({
        sub: username,
        uid: userId,
        exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
      })
    )
  );
  const signature = await crypto.subtle.sign('HMAC', await getSigningKey(), encoder.encode(payload));

  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function getSessionPayload(token: string | undefined): Promise<SessionData | null> {
  if (!token || token.length > 2048 || !isAuthConfigured()) {
    return null;
  }

  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) {
    return null;
  }

  try {
    const key = await getSigningKey();
    const isValidSignature = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(signature),
      encoder.encode(payload)
    );
    if (!isValidSignature) {
      return null;
    }

    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as {
      sub?: unknown;
      uid?: unknown;
      exp?: unknown;
    };

    if (
      typeof session.sub === 'string' &&
      session.sub.trim().length > 0 &&
      typeof session.exp === 'number' &&
      Number.isSafeInteger(session.exp) &&
      session.exp > Math.floor(Date.now() / 1000)
    ) {
      return {
        sub: session.sub,
        uid: typeof session.uid === 'string' ? session.uid : undefined,
        exp: session.exp,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const session = await getSessionPayload(token);
  return session !== null;
}
