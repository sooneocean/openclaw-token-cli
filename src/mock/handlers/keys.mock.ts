import type { MockRouter, MockRequest, MockResponse } from '../handler.js';
import type { MockStore, MockProvisionedKey } from '../store.js';
import { requireValidToken } from '../utils.js';

function getKeysForEmail(store: MockStore, email: string): MockProvisionedKey[] {
  return store.keys.get(email) ?? [];
}

export function registerKeysHandlers(router: MockRouter): void {
  // POST /keys
  router.register('POST', '/keys', (req: MockRequest, store: MockStore): MockResponse => {
    const result = requireValidToken(req, store);
    if (typeof result !== 'string') return result;
    const email = result;

    const body = req.body as {
      name?: string;
      credit_limit?: number | null;
      limit_reset?: 'daily' | 'weekly' | 'monthly' | null;
      expires_at?: string | null;
    } | undefined;

    if (!body?.name) {
      return { status: 400, data: { error: { code: 'INVALID_INPUT', message: 'Key name is required' } } };
    }

    const existingKeys = getKeysForEmail(store, email);
    const duplicate = existingKeys.find((k) => k.name === body.name && !k.revoked);
    if (duplicate) {
      return { status: 409, data: { error: { code: 'KEY_NAME_EXISTS', message: `Key name '${body.name}' already exists` } } };
    }

    const keyValue = store.generateProvisionedKey();
    const hash = store.generateKeyHash();
    const now = new Date().toISOString();

    const newKey: MockProvisionedKey = {
      key: keyValue,
      hash,
      name: body.name,
      credit_limit: body.credit_limit ?? null,
      limit_reset: body.limit_reset ?? null,
      usage: 0,
      disabled: false,
      revoked: false,
      created_at: now,
      expires_at: body.expires_at ?? null,
    };

    store.keys.set(email, [...existingKeys, newKey]);

    return {
      status: 201,
      data: {
        data: {
          key: keyValue,
          hash,
          name: body.name,
          credit_limit: newKey.credit_limit,
          limit_reset: newKey.limit_reset,
          usage: 0,
          disabled: false,
          created_at: now,
          expires_at: newKey.expires_at,
        },
      },
    };
  });

  // GET /keys
  router.register('GET', '/keys', (req: MockRequest, store: MockStore): MockResponse => {
    const result = requireValidToken(req, store);
    if (typeof result !== 'string') return result;
    const email = result;

    const includeRevoked = req.query?.include_revoked === 'true';
    const keys = getKeysForEmail(store, email);
    const items = keys
      .filter((k) => includeRevoked || !k.revoked)
      .map(({ key: _k, revoked: _r, ...rest }) => rest);

    return { status: 200, data: { data: { items, total: items.length } } };
  });

  // GET /keys/:hash
  router.register('GET', '/keys/:hash', (req: MockRequest, store: MockStore): MockResponse => {
    const result = requireValidToken(req, store);
    if (typeof result !== 'string') return result;
    const email = result;

    const hash = req.query?.hash;
    const keys = getKeysForEmail(store, email);
    const key = hash ? keys.find((k) => k.hash === hash) : undefined;

    if (!key || key.revoked) {
      return { status: 404, data: { error: { code: 'KEY_NOT_FOUND', message: 'Key not found' } } };
    }

    return {
      status: 200,
      data: {
        data: {
          hash: key.hash,
          name: key.name,
          credit_limit: key.credit_limit,
          limit_reset: key.limit_reset,
          usage: key.usage,
          usage_daily: Math.round(key.usage * 0.15 * 100) / 100,
          usage_weekly: Math.round(key.usage * 0.6 * 100) / 100,
          usage_monthly: key.usage,
          requests_count: Math.floor(key.usage * 40),
          disabled: key.disabled,
          created_at: key.created_at,
          expires_at: key.expires_at,
          model_usage: [
            {
              model: 'claude-sonnet-4-5',
              requests: Math.floor(key.usage * 20),
              tokens: Math.floor(key.usage * 30000),
              cost: Math.round(key.usage * 0.55 * 100) / 100,
            },
            {
              model: 'gpt-4o',
              requests: Math.floor(key.usage * 20),
              tokens: Math.floor(key.usage * 25000),
              cost: Math.round(key.usage * 0.45 * 100) / 100,
            },
          ],
        },
      },
    };
  });

  // PATCH /keys/:hash
  router.register('PATCH', '/keys/:hash', (req: MockRequest, store: MockStore): MockResponse => {
    const result = requireValidToken(req, store);
    if (typeof result !== 'string') return result;
    const email = result;

    const hash = req.query?.hash;
    const keys = getKeysForEmail(store, email);
    const key = hash ? keys.find((k) => k.hash === hash) : undefined;

    if (!key || key.revoked) {
      return { status: 404, data: { error: { code: 'KEY_NOT_FOUND', message: 'Key not found' } } };
    }

    const body = req.body as {
      credit_limit?: number | null;
      limit_reset?: 'daily' | 'weekly' | 'monthly' | null;
      disabled?: boolean;
    } | undefined;

    if (body?.credit_limit !== undefined) key.credit_limit = body.credit_limit;
    if (body?.limit_reset !== undefined) key.limit_reset = body.limit_reset;
    if (body?.disabled !== undefined) key.disabled = body.disabled;

    return {
      status: 200,
      data: {
        data: {
          hash: key.hash,
          name: key.name,
          credit_limit: key.credit_limit,
          limit_reset: key.limit_reset,
          usage: key.usage,
          disabled: key.disabled,
          created_at: key.created_at,
          expires_at: key.expires_at,
          updated_at: new Date().toISOString(),
        },
      },
    };
  });

  // POST /keys/:hash/rotate
  router.register('POST', '/keys/:hash/rotate', (req: MockRequest, store: MockStore): MockResponse => {
    const result = requireValidToken(req, store);
    if (typeof result !== 'string') return result;
    const email = result;

    const hash = req.query?.hash;
    const keys = getKeysForEmail(store, email);
    const key = hash ? keys.find((k) => k.hash === hash) : undefined;

    if (!key) {
      return { status: 404, data: { error: { code: 'KEY_NOT_FOUND', message: 'Key not found' } } };
    }
    if (key.revoked) {
      return { status: 410, data: { error: { code: 'KEY_REVOKED', message: 'Cannot rotate a revoked key' } } };
    }

    const newKeyValue = store.generateProvisionedKey();
    key.key = newKeyValue;

    return {
      status: 200,
      data: {
        data: {
          key: newKeyValue,
          hash: key.hash,
          name: key.name,
          credit_limit: key.credit_limit,
          limit_reset: key.limit_reset,
          usage: key.usage,
          disabled: key.disabled,
          created_at: key.created_at,
          expires_at: key.expires_at,
          rotated_at: new Date().toISOString(),
        },
      },
    };
  });

  // DELETE /keys/:hash
  router.register('DELETE', '/keys/:hash', (req: MockRequest, store: MockStore): MockResponse => {
    const result = requireValidToken(req, store);
    if (typeof result !== 'string') return result;
    const email = result;

    const hash = req.query?.hash;
    const keys = getKeysForEmail(store, email);
    const key = hash ? keys.find((k) => k.hash === hash) : undefined;

    if (!key) {
      return { status: 404, data: { error: { code: 'KEY_NOT_FOUND', message: 'Key not found' } } };
    }
    if (key.revoked) {
      return { status: 410, data: { error: { code: 'KEY_ALREADY_REVOKED', message: 'Key has already been revoked' } } };
    }

    key.revoked = true;

    return {
      status: 200,
      data: { data: { hash: key.hash, name: key.name, revoked: true, revoked_at: new Date().toISOString() } },
    };
  });
}
