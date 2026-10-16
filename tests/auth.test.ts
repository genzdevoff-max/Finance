import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, verifyPassword } from '../lib/auth/password';
import { createSessionToken, verifySessionToken } from '../lib/auth/session';

test('password hashes are salted, verified, and enforce a minimum length', async () => {
  const password = 'correct horse battery staple';
  const hash = await hashPassword(password);

  assert.match(hash, /^scrypt\$/);
  assert.notEqual(await hashPassword(password), hash);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('incorrect password', hash), false);
  await assert.rejects(hashPassword('short'));
});

test('sessions require a valid signature, valid payload, and unexpired token', async () => {
  const originalEnvironment = {
    sessionSecret: process.env.AUTH_SESSION_SECRET,
  };

  try {
    process.env.AUTH_SESSION_SECRET = 'test-session-secret-that-is-at-least-32-bytes';

    const token = await createSessionToken('owner', 'test-user-id');
    assert.equal(await verifySessionToken(token), true);
    assert.equal(await verifySessionToken(`${token}tampered`), false);
    assert.equal(await verifySessionToken(undefined), false);
    assert.equal(await verifySessionToken('invalid.token'), false);

    // Another registered user gets a valid token as well
    const anotherToken = await createSessionToken('another-user', 'user-2');
    assert.equal(await verifySessionToken(anotherToken), true);

    const originalNow = Date.now;
    Date.now = () => originalNow() + 13 * 60 * 60 * 1000;
    try {
      assert.equal(await verifySessionToken(token), false);
    } finally {
      Date.now = originalNow;
    }

    process.env.AUTH_SESSION_SECRET = 'a-different-session-secret-that-is-long-enough';
    assert.equal(await verifySessionToken(token), false);
  } finally {
    if (originalEnvironment.sessionSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
    else process.env.AUTH_SESSION_SECRET = originalEnvironment.sessionSecret;
  }
});
