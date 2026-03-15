import type { MockRouter, MockRequest, MockResponse } from '../handler.js';
import type { MockStore } from '../store.js';

function extractBearerToken(req: MockRequest): string | null {
  const auth = req.headers?.['Authorization'] || req.headers?.['authorization'];
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export function registerOAuthHandlers(router: MockRouter): void {
  router.register('POST', '/oauth/device/code', (req: MockRequest, store: MockStore): MockResponse => {
    const body = req.body as { client_id?: string; _test_email?: string } | undefined;
    if (!body?.client_id) {
      return { status: 400, data: { error: { code: 'INVALID_INPUT', message: 'client_id is required' } } };
    }

    const device_code = store.generateDeviceCode();
    const user_code = store.generateUserCode();

    store.oauthSessions.set(device_code, {
      device_code,
      user_code,
      client_id: body.client_id,
      access_token: null,
      authorized: false,
      auto_authorize_at: Date.now() + 3000,
      expires_at: Date.now() + 900000,
      email: body._test_email || 'github-user@example.com',
      created_at: new Date().toISOString(),
    });

    return {
      status: 200,
      data: {
        data: {
          device_code,
          user_code,
          verification_uri: 'https://github.com/login/device',
          interval: 5,
          expires_in: 900,
        },
      },
    };
  });

  router.register('POST', '/oauth/device/token', (req: MockRequest, store: MockStore): MockResponse => {
    const body = req.body as { device_code?: string } | undefined;
    if (!body?.device_code) {
      return { status: 400, data: { error: { code: 'bad_device_code', message: 'Invalid device code' } } };
    }

    const session = store.oauthSessions.get(body.device_code);
    if (!session) {
      return { status: 400, data: { error: { code: 'bad_device_code', message: 'Invalid device code' } } };
    }

    if (Date.now() > session.expires_at) {
      return { status: 400, data: { error: { code: 'expired_token', message: 'Device code expired' } } };
    }

    if (session.authorized && session.access_token) {
      return {
        status: 200,
        data: { data: { access_token: session.access_token, token_type: 'bearer' } },
      };
    }

    if (!session.authorized && Date.now() >= session.auto_authorize_at) {
      session.authorized = true;
      session.access_token = store.generateAccessToken();
      return {
        status: 200,
        data: { data: { access_token: session.access_token, token_type: 'bearer' } },
      };
    }

    return {
      status: 400,
      data: { error: { code: 'authorization_pending', message: 'The authorization request is still pending.' } },
    };
  });

  router.register('GET', '/oauth/userinfo', (req: MockRequest, store: MockStore): MockResponse => {
    const token = extractBearerToken(req);

    const session = token
      ? Array.from(store.oauthSessions.values()).find(
          (s) => s.access_token === token && s.authorized,
        )
      : undefined;

    if (!session) {
      return { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing access token' } } };
    }

    const email = session.email;
    if (!email) {
      return { status: 400, data: { error: { code: 'EMAIL_REQUIRED', message: 'GitHub account has no public email' } } };
    }

    const existingUser = store.users.get(email);
    let management_key: string;
    let merged: boolean;

    if (existingUser) {
      existingUser.oauth_provider = 'github';
      management_key = existingUser.management_key;
      merged = true;
    } else {
      management_key = store.generateManagementKey();
      const now = new Date().toISOString();
      store.users.set(email, {
        email,
        management_key,
        plan: 'free',
        created_at: now,
        oauth_provider: 'github',
      });
      store.credits.set(email, { total_credits: 0, total_usage: 0 });
      store.transactions.set(email, []);
      store.keys.set(email, []);
      store.autoTopup.set(email, { enabled: false, threshold: 5, amount: 25 });
      merged = false;
    }

    return {
      status: 200,
      data: {
        data: {
          management_key,
          email,
          name: 'GitHub User',
          avatar_url: 'https://avatars.githubusercontent.com/u/0',
          merged,
        },
      },
    };
  });
}
