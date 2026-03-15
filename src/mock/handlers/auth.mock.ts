import type { MockRouter, MockRequest, MockResponse } from '../handler.js';
import type { MockStore } from '../store.js';

function extractToken(req: MockRequest): string | null {
  const auth = req.headers?.['Authorization'] || req.headers?.['authorization'];
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function requireValidToken(req: MockRequest, store: MockStore): MockResponse | string {
  const token = extractToken(req);
  if (!token || !store.isValidToken(token)) {
    return { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' } } };
  }
  return store.getEmailForToken(token);
}

export function registerAuthHandlers(router: MockRouter): void {
  router.register('POST', '/auth/register', (req: MockRequest, store: MockStore): MockResponse => {
    const body = req.body as { email?: string; password?: string } | undefined;
    if (!body?.email || !body?.password) {
      return { status: 400, data: { error: { code: 'INVALID_INPUT', message: 'Email and password are required' } } };
    }
    if (store.users.has(body.email)) {
      return { status: 409, data: { error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } } };
    }

    const managementKey = store.generateManagementKey();
    const now = new Date().toISOString();

    store.users.set(body.email, {
      email: body.email, password: body.password,
      management_key: managementKey, plan: 'free', created_at: now,
    });
    store.credits.set(body.email, { total_credits: 0, total_usage: 0 });
    store.transactions.set(body.email, []);
    store.keys.set(body.email, []);
    store.autoTopup.set(body.email, { enabled: false, threshold: 5, amount: 25 });

    return { status: 201, data: { data: { management_key: managementKey, email: body.email, created_at: now } } };
  });

  router.register('POST', '/auth/login', (req: MockRequest, store: MockStore): MockResponse => {
    const body = req.body as { email?: string; password?: string } | undefined;
    if (!body?.email || !body?.password) {
      return { status: 400, data: { error: { code: 'INVALID_INPUT', message: 'Email and password are required' } } };
    }
    const user = store.users.get(body.email);
    if (!user || !user.password || user.password !== body.password) {
      return { status: 401, data: { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } } };
    }
    return { status: 200, data: { data: { management_key: user.management_key, email: user.email, last_login: new Date().toISOString() } } };
  });

  router.register('POST', '/auth/rotate', (req: MockRequest, store: MockStore): MockResponse => {
    const requestToken = extractToken(req);
    const result = requireValidToken(req, store);
    if (typeof result !== 'string') return result;
    const email = result;

    const user = store.users.get(email);
    if (!user) {
      return { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing token' } } };
    }

    const oldKey = user.management_key;
    const newKey = store.generateManagementKey();

    store.revokedManagementKeys.add(oldKey);
    if (requestToken && requestToken !== oldKey) {
      store.revokedManagementKeys.add(requestToken);
    }
    user.management_key = newKey;

    return {
      status: 200,
      data: { data: { management_key: newKey, email: user.email, rotated_at: new Date().toISOString() } },
    };
  });

  router.register('GET', '/auth/me', (req: MockRequest, store: MockStore): MockResponse => {
    const result = requireValidToken(req, store);
    if (typeof result !== 'string') return result;
    const email = result;
    const user = store.users.get(email);
    const credits = store.credits.get(email);
    const userKeys = store.keys.get(email) || [];
    const keyCount = userKeys.filter((k) => !k.revoked).length;

    return {
      status: 200,
      data: {
        data: {
          email: user?.email || email, plan: user?.plan || 'free',
          credits_remaining: credits ? credits.total_credits - credits.total_usage : 0,
          keys_count: keyCount, created_at: user?.created_at || new Date().toISOString(),
        },
      },
    };
  });
}
