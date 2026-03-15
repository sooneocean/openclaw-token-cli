import { describe, it, expect, beforeEach } from 'vitest';
import { mockStore } from '../../../../src/mock/store.js';
import { handleMockRequest } from '../../../../src/mock/index.js';

describe('OAuth Mock Handlers', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  // 1. POST /oauth/device/code — success
  it('POST /oauth/device/code returns device_code and user_code', async () => {
    const resp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/code',
      body: { client_id: 'openclaw-cli' },
    });
    expect(resp.status).toBe(200);
    const data = (resp.data as any).data;
    expect(data.device_code).toMatch(/^dc_/);
    expect(data.user_code).toMatch(/^[A-Z]{4}-[A-Z]{4}$/);
    expect(data.verification_uri).toBe('https://github.com/login/device');
    expect(data.interval).toBe(5);
    expect(data.expires_in).toBe(900);
  });

  // 2. POST /oauth/device/code — no client_id returns 400
  it('POST /oauth/device/code without client_id returns 400', async () => {
    const resp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/code',
      body: {},
    });
    expect(resp.status).toBe(400);
  });

  // 3. POST /oauth/device/token — authorization_pending (before auto-authorize)
  it('POST /oauth/device/token returns authorization_pending before auto-authorize', async () => {
    // Create a device code with far-future auto_authorize_at
    const codeResp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/code',
      body: { client_id: 'openclaw-cli' },
    });
    const deviceCode = (codeResp.data as any).data.device_code;
    // Manually set auto_authorize_at to far future
    const session = mockStore.oauthSessions.get(deviceCode)!;
    session.auto_authorize_at = Date.now() + 999999;

    const resp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/token',
      body: { device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' },
    });
    expect(resp.status).toBe(400);
    expect((resp.data as any).error.code).toBe('authorization_pending');
  });

  // 4. POST /oauth/device/token — access_token (after auto-authorize time)
  it('POST /oauth/device/token returns access_token after auto-authorize', async () => {
    const codeResp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/code',
      body: { client_id: 'openclaw-cli' },
    });
    const deviceCode = (codeResp.data as any).data.device_code;
    // Set auto_authorize_at to past
    const session = mockStore.oauthSessions.get(deviceCode)!;
    session.auto_authorize_at = Date.now() - 1;

    const resp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/token',
      body: { device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' },
    });
    expect(resp.status).toBe(200);
    expect((resp.data as any).data.access_token).toMatch(/^gho_/);
    expect((resp.data as any).data.token_type).toBe('bearer');
  });

  // 5. POST /oauth/device/token — expired_token
  it('POST /oauth/device/token returns expired_token for expired device code', async () => {
    const codeResp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/code',
      body: { client_id: 'openclaw-cli' },
    });
    const deviceCode = (codeResp.data as any).data.device_code;
    // Set expires_at to past
    const session = mockStore.oauthSessions.get(deviceCode)!;
    session.expires_at = Date.now() - 1;

    const resp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/token',
      body: { device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' },
    });
    expect(resp.status).toBe(400);
    expect((resp.data as any).error.code).toBe('expired_token');
  });

  // 6. POST /oauth/device/token — bad_device_code
  it('POST /oauth/device/token returns bad_device_code for unknown code', async () => {
    const resp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/token',
      body: { device_code: 'dc_nonexistent', grant_type: 'urn:ietf:params:oauth:grant-type:device_code' },
    });
    expect(resp.status).toBe(400);
    expect((resp.data as any).error.code).toBe('bad_device_code');
  });

  // 7. GET /oauth/userinfo — new user creation
  it('GET /oauth/userinfo creates new user for unknown email', async () => {
    // Setup: create and authorize a device code
    const codeResp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/code',
      body: { client_id: 'openclaw-cli' },
    });
    const deviceCode = (codeResp.data as any).data.device_code;
    const session = mockStore.oauthSessions.get(deviceCode)!;
    session.auto_authorize_at = Date.now() - 1;

    // Get token
    const tokenResp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/token',
      body: { device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' },
    });
    const accessToken = (tokenResp.data as any).data.access_token;

    // Get userinfo
    const resp = await handleMockRequest({
      method: 'GET', path: '/oauth/userinfo',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resp.status).toBe(200);
    const data = (resp.data as any).data;
    expect(data.management_key).toMatch(/^sk-mgmt-/);
    expect(data.email).toBe('github-user@example.com');
    expect(data.merged).toBe(false);
  });

  // 8. GET /oauth/userinfo — existing user merge
  it('GET /oauth/userinfo merges with existing user (same email)', async () => {
    // Register a user with same email as mock OAuth
    await handleMockRequest({
      method: 'POST', path: '/auth/register',
      body: { email: 'github-user@example.com', password: 'Test1234!' },
    });
    const existingUser = mockStore.users.get('github-user@example.com')!;
    const existingKey = existingUser.management_key;

    // OAuth flow
    const codeResp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/code',
      body: { client_id: 'openclaw-cli' },
    });
    const deviceCode = (codeResp.data as any).data.device_code;
    mockStore.oauthSessions.get(deviceCode)!.auto_authorize_at = Date.now() - 1;

    const tokenResp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/token',
      body: { device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' },
    });
    const accessToken = (tokenResp.data as any).data.access_token;

    const resp = await handleMockRequest({
      method: 'GET', path: '/oauth/userinfo',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resp.status).toBe(200);
    const data = (resp.data as any).data;
    expect(data.management_key).toBe(existingKey); // Same key!
    expect(data.merged).toBe(true);
    expect(mockStore.users.get('github-user@example.com')!.oauth_provider).toBe('github');
  });

  // 9. GET /oauth/userinfo — email empty returns 400
  it('GET /oauth/userinfo returns 400 when email is empty', async () => {
    const codeResp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/code',
      body: { client_id: 'openclaw-cli' },
    });
    const deviceCode = (codeResp.data as any).data.device_code;
    const session = mockStore.oauthSessions.get(deviceCode)!;
    session.auto_authorize_at = Date.now() - 1;
    session.email = ''; // Empty email

    const tokenResp = await handleMockRequest({
      method: 'POST', path: '/oauth/device/token',
      body: { device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' },
    });
    const accessToken = (tokenResp.data as any).data.access_token;

    const resp = await handleMockRequest({
      method: 'GET', path: '/oauth/userinfo',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(resp.status).toBe(400);
    expect((resp.data as any).error.code).toBe('EMAIL_REQUIRED');
  });

  // 10. GET /oauth/userinfo — invalid token returns 401
  it('GET /oauth/userinfo returns 401 for invalid token', async () => {
    const resp = await handleMockRequest({
      method: 'GET', path: '/oauth/userinfo',
      headers: { Authorization: 'Bearer invalid_token' },
    });
    expect(resp.status).toBe(401);
  });
});
