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
});
