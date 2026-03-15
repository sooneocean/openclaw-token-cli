import { describe, it, expect, beforeEach } from 'vitest';
import { mockStore } from '../../../../src/mock/store.js';
import { handleMockRequest, clearHandlers } from '../../../../src/mock/index.js';

describe('Auth Mock Handlers', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  it('POST /auth/register success', async () => {
    const resp = await handleMockRequest({
      method: 'POST', path: '/auth/register',
      body: { email: 'new@test.com', password: 'Test1234!' },
    });
    expect(resp.status).toBe(201);
    const data = (resp.data as any).data;
    expect(data.management_key).toMatch(/^sk-mgmt-/);
    expect(data.email).toBe('new@test.com');
  });

  it('POST /auth/register duplicate email returns 409', async () => {
    const resp = await handleMockRequest({
      method: 'POST', path: '/auth/register',
      body: { email: 'demo@openclaw.dev', password: 'Test1234!' },
    });
    expect(resp.status).toBe(409);
  });

  it('POST /auth/login success', async () => {
    const resp = await handleMockRequest({
      method: 'POST', path: '/auth/login',
      body: { email: 'demo@openclaw.dev', password: 'Demo1234!' },
    });
    expect(resp.status).toBe(200);
    expect((resp.data as any).data.management_key).toBeTruthy();
  });

  it('POST /auth/login wrong password returns 401', async () => {
    const resp = await handleMockRequest({
      method: 'POST', path: '/auth/login',
      body: { email: 'demo@openclaw.dev', password: 'wrong' },
    });
    expect(resp.status).toBe(401);
  });

  it('GET /auth/me with valid token returns 200', async () => {
    const resp = await handleMockRequest({
      method: 'GET', path: '/auth/me',
      headers: { Authorization: 'Bearer sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    });
    expect(resp.status).toBe(200);
    expect((resp.data as any).data.email).toBe('demo@openclaw.dev');
  });

  it('GET /auth/me without token returns 401', async () => {
    const resp = await handleMockRequest({ method: 'GET', path: '/auth/me' });
    expect(resp.status).toBe(401);
  });

  describe('POST /auth/rotate', () => {
    const validToken = 'sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    it('rotate with valid token returns new key', async () => {
      const resp = await handleMockRequest({
        method: 'POST', path: '/auth/rotate',
        headers: { Authorization: `Bearer ${validToken}` },
      });
      expect(resp.status).toBe(200);
      const data = (resp.data as any).data;
      expect(data.management_key).toMatch(/^sk-mgmt-/);
      expect(data.management_key).not.toBe(validToken);
      expect(data.email).toBe('demo@openclaw.dev');
      expect(data.rotated_at).toBeTruthy();
    });

    it('old key returns 401 after rotation', async () => {
      // First rotate
      const rotateResp = await handleMockRequest({
        method: 'POST', path: '/auth/rotate',
        headers: { Authorization: `Bearer ${validToken}` },
      });
      expect(rotateResp.status).toBe(200);

      // Old key should now be invalid
      const meResp = await handleMockRequest({
        method: 'GET', path: '/auth/me',
        headers: { Authorization: `Bearer ${validToken}` },
      });
      expect(meResp.status).toBe(401);
    });

    it('new key works after rotation', async () => {
      const rotateResp = await handleMockRequest({
        method: 'POST', path: '/auth/rotate',
        headers: { Authorization: `Bearer ${validToken}` },
      });
      const newKey = (rotateResp.data as any).data.management_key;

      const meResp = await handleMockRequest({
        method: 'GET', path: '/auth/me',
        headers: { Authorization: `Bearer ${newKey}` },
      });
      expect(meResp.status).toBe(200);
      expect((meResp.data as any).data.email).toBe('demo@openclaw.dev');
    });

    it('invalid token returns 401', async () => {
      const resp = await handleMockRequest({
        method: 'POST', path: '/auth/rotate',
        headers: { Authorization: 'Bearer invalid-token' },
      });
      expect(resp.status).toBe(401);
    });

    it('consecutive rotations invalidate all previous keys', async () => {
      // First rotation
      const resp1 = await handleMockRequest({
        method: 'POST', path: '/auth/rotate',
        headers: { Authorization: `Bearer ${validToken}` },
      });
      const key1 = (resp1.data as any).data.management_key;

      // Second rotation with new key
      const resp2 = await handleMockRequest({
        method: 'POST', path: '/auth/rotate',
        headers: { Authorization: `Bearer ${key1}` },
      });
      expect(resp2.status).toBe(200);

      // Original key should be 401
      const check1 = await handleMockRequest({
        method: 'GET', path: '/auth/me',
        headers: { Authorization: `Bearer ${validToken}` },
      });
      expect(check1.status).toBe(401);

      // First rotated key should also be 401
      const check2 = await handleMockRequest({
        method: 'GET', path: '/auth/me',
        headers: { Authorization: `Bearer ${key1}` },
      });
      expect(check2.status).toBe(401);
    });
  });
});
