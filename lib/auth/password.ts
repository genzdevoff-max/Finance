import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { isPasswordHash } from './config';

const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};
const KEY_LENGTH = 64;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt$${salt.toString('base64url')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const normalizedHash = encodedHash.replaceAll('\\$', '$');
  if (!isPasswordHash(normalizedHash)) {
    return false;
  }

  const [, saltValue, expectedValue] = normalizedHash.split('$');
  const salt = Buffer.from(saltValue, 'base64url');
  const expected = Buffer.from(expectedValue, 'hex');
  const actual = await deriveKey(password, salt);

  return timingSafeEqual(actual, expected);
}
