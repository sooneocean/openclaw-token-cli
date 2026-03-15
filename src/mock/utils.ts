import type { MockRequest, MockResponse } from './handler.js';
import type { MockStore } from './store.js';

export function extractToken(req: MockRequest): string | null {
  const auth = req.headers?.['Authorization'] || req.headers?.['authorization'];
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export function requireValidToken(req: MockRequest, store: MockStore): MockResponse | string {
  const token = extractToken(req);
  if (!token || !store.isValidToken(token)) {
    return { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' } } };
  }
  const email = store.getEmailForToken(token);
  if (!email) {
    return { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' } } };
  }
  return email;
}
