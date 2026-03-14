import { describe, it, expect, beforeEach } from 'vitest';
import { mockStore } from '../../../../src/mock/store.js';
import { handleMockRequest } from '../../../../src/mock/index.js';

const AUTH_HEADER = { Authorization: 'Bearer sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890' };

describe('Keys Mock Handlers', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  it('POST /keys creates key with 201', async () => {
    const resp = await handleMockRequest({
      method: 'POST', path: '/keys',
      body: { name: 'test-agent', credit_limit: 10 }, headers: AUTH_HEADER,
    });
    expect(resp.status).toBe(201);
    const data = (resp.data as any).data;
    expect(data.key).toMatch(/^sk-prov-/);
    expect(data.hash).toMatch(/^hash_/);
    expect(data.name).toBe('test-agent');
  });

  it('POST /keys duplicate name returns 409', async () => {
    await handleMockRequest({
      method: 'POST', path: '/keys',
      body: { name: 'dup-key' }, headers: AUTH_HEADER,
    });
    const resp = await handleMockRequest({
      method: 'POST', path: '/keys',
      body: { name: 'dup-key' }, headers: AUTH_HEADER,
    });
    expect(resp.status).toBe(409);
  });

  it('GET /keys lists keys', async () => {
    await handleMockRequest({
      method: 'POST', path: '/keys',
      body: { name: 'key1' }, headers: AUTH_HEADER,
    });
    const resp = await handleMockRequest({ method: 'GET', path: '/keys', headers: AUTH_HEADER });
    expect(resp.status).toBe(200);
    expect((resp.data as any).data.items.length).toBe(1);
  });

  it('GET /keys/:hash returns key detail', async () => {
    const createResp = await handleMockRequest({
      method: 'POST', path: '/keys',
      body: { name: 'detail-key' }, headers: AUTH_HEADER,
    });
    const hash = (createResp.data as any).data.hash;

    const resp = await handleMockRequest({
      method: 'GET', path: `/keys/${hash}`, headers: AUTH_HEADER,
    });
    expect(resp.status).toBe(200);
    expect((resp.data as any).data.name).toBe('detail-key');
  });

  it('PATCH /keys/:hash updates key', async () => {
    const createResp = await handleMockRequest({
      method: 'POST', path: '/keys',
      body: { name: 'update-key', credit_limit: 10 }, headers: AUTH_HEADER,
    });
    const hash = (createResp.data as any).data.hash;

    const resp = await handleMockRequest({
      method: 'PATCH', path: `/keys/${hash}`,
      body: { credit_limit: 20 }, headers: AUTH_HEADER,
    });
    expect(resp.status).toBe(200);
    expect((resp.data as any).data.credit_limit).toBe(20);
  });

  it('DELETE /keys/:hash revokes key', async () => {
    const createResp = await handleMockRequest({
      method: 'POST', path: '/keys',
      body: { name: 'revoke-key' }, headers: AUTH_HEADER,
    });
    const hash = (createResp.data as any).data.hash;

    const resp = await handleMockRequest({
      method: 'DELETE', path: `/keys/${hash}`, headers: AUTH_HEADER,
    });
    expect(resp.status).toBe(200);
    expect((resp.data as any).data.revoked).toBe(true);
  });

  it('DELETE already revoked key returns 410', async () => {
    const createResp = await handleMockRequest({
      method: 'POST', path: '/keys',
      body: { name: 'twice-revoke' }, headers: AUTH_HEADER,
    });
    const hash = (createResp.data as any).data.hash;

    await handleMockRequest({ method: 'DELETE', path: `/keys/${hash}`, headers: AUTH_HEADER });
    const resp = await handleMockRequest({ method: 'DELETE', path: `/keys/${hash}`, headers: AUTH_HEADER });
    expect(resp.status).toBe(410);
  });
});
