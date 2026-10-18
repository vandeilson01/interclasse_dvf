import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'interclasse_session';
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
const MIN_SHARED_PASSWORD_LENGTH = 24;

export function configuredSharedPassword(env = process.env) {
  const value = typeof env.INTERCLASSE_SHARED_PASSWORD === 'string'
    ? env.INTERCLASSE_SHARED_PASSWORD
    : '';
  return value.length >= MIN_SHARED_PASSWORD_LENGTH ? value : null;
}

export function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left ?? ''), 'utf8');
  const b = Buffer.from(String(right ?? ''), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSessionToken(sharedPassword, nowMs = Date.now()) {
  const expiresAt = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const nonce = randomBytes(18).toString('base64url');
  const payload = `${expiresAt}.${nonce}`;
  const signature = createHmac('sha256', sharedPassword).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySessionToken(token, sharedPassword, nowMs = Date.now()) {
  if (typeof token !== 'string' || !sharedPassword) return false;
  const [expiresText, nonce, signature, extra] = token.split('.');
  if (extra !== undefined || !/^\d+$/.test(expiresText || '') || !/^[A-Za-z0-9_-]{20,30}$/.test(nonce || '') || !/^[A-Za-z0-9_-]{43}$/.test(signature || '')) return false;
  const expiresAt = Number(expiresText);
  const nowSeconds = Math.floor(nowMs / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowSeconds || expiresAt > nowSeconds + SESSION_TTL_SECONDS + 60) return false;
  const payload = `${expiresText}.${nonce}`;
  const expected = createHmac('sha256', sharedPassword).update(payload).digest();
  let supplied;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { return false; }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function readCookie(req, name = SESSION_COOKIE) {
  const header = String(req?.headers?.cookie || '');
  for (const segment of header.split(';')) {
    const separator = segment.indexOf('=');
    if (separator < 0) continue;
    if (segment.slice(0, separator).trim() === name) return segment.slice(separator + 1).trim();
  }
  return '';
}

export function hasValidSession(req, sharedPassword, nowMs = Date.now()) {
  return verifySessionToken(readCookie(req), sharedPassword, nowMs);
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=None`;
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=None`;
}

export function isSameOriginRequest(req) {
  const origin = String(req?.headers?.origin || '');
  const requestHost = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim().toLowerCase();
  if (!origin || !requestHost) return false;
  try {
    const parsed = new URL(origin);
    const secureOrLocal = parsed.protocol === 'https:'
      || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname));
    return secureOrLocal && parsed.host.toLowerCase() === requestHost;
  } catch {
    return false;
  }
}
