import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_TTL_SECONDS,
  configuredSharedPassword,
  createSessionToken,
  isSameOriginRequest,
  readCookie,
  sessionCookie,
  verifySessionToken,
} from '../server/session.js';

const testPassword = 'local-test-only-password-1234567890';
const fixedNow = Date.UTC(2026, 9, 18, 15, 0, 0);

test('requires a long shared password in the server environment', () => {
  assert.equal(configuredSharedPassword({ INTERCLASSE_SHARED_PASSWORD: 'short' }), null);
  assert.equal(configuredSharedPassword({ INTERCLASSE_SHARED_PASSWORD: testPassword }), testPassword);
});

test('signs a session and rejects a wrong secret, tampering, or expiry', () => {
  const token = createSessionToken(testPassword, fixedNow);
  assert.equal(verifySessionToken(token, testPassword, fixedNow), true);
  assert.equal(verifySessionToken(token, `${testPassword}x`, fixedNow), false);
  assert.equal(verifySessionToken(`${token}x`, testPassword, fixedNow), false);
  assert.equal(verifySessionToken(token, testPassword, fixedNow + SESSION_TTL_SECONDS * 1000), false);
});

test('session cookie is HttpOnly, Secure, SameSite=None and expires after twelve hours', () => {
  const token = createSessionToken(testPassword, fixedNow);
  const cookie = sessionCookie(token);
  assert.match(cookie, /^interclasse_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=None/);
  assert.match(cookie, /Max-Age=43200/);
});

test('reads the named session cookie among unrelated cookies', () => {
  const token = createSessionToken(testPassword, fixedNow);
  const req = { headers: { cookie: `theme=dark; interclasse_session=${token}; locale=pt-BR` } };
  assert.equal(readCookie(req), token);
});

test('accepts same-origin requests and rejects a forged origin', () => {
  assert.equal(isSameOriginRequest({ headers: { origin: 'https://school.example', host: 'school.example' } }), true);
  assert.equal(isSameOriginRequest({ headers: { origin: 'https://evil.example', host: 'school.example' } }), false);
  assert.equal(isSameOriginRequest({ headers: { host: 'school.example' } }), false);
});
