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

  describe('POST /keys/:hash/rotate', () => {
    it('rotate returns new key value with preserved settings', async () => {
      const createResp = await handleMockRequest({
        method: 'POST', path: '/keys',
        body: { name: 'rotate-key', credit_limit: 50, limit_reset: 'monthly' }, headers: AUTH_HEADER,
      });
      const hash = (createResp.data as any).data.hash;
      const originalKey = (createResp.data as any).data.key;

      const resp = await handleMockRequest({
        method: 'POST', path: `/keys/${hash}/rotate`, headers: AUTH_HEADER,
      });
      expect(resp.status).toBe(200);
      const data = (resp.data as any).data;
      expect(data.key).toMatch(/^sk-prov-/);
      expect(data.key).not.toBe(originalKey);
      expect(data.hash).toBe(hash);
      expect(data.name).toBe('rotate-key');
      expect(data.credit_limit).toBe(50);
      expect(data.limit_reset).toBe('monthly');
      expect(data.rotated_at).toBeTruthy();
    });

    it('rotate updates stored key value', async () => {
      const createResp = await handleMockRequest({
        method: 'POST', path: '/keys',
        body: { name: 'update-check' }, headers: AUTH_HEADER,
      });
      const hash = (createResp.data as any).data.hash;

      const resp1 = await handleMockRequest({
        method: 'POST', path: `/keys/${hash}/rotate`, headers: AUTH_HEADER,
      });
      const key1 = (resp1.data as any).data.key;

      const resp2 = await handleMockRequest({
        method: 'POST', path: `/keys/${hash}/rotate`, headers: AUTH_HEADER,
      });
      const key2 = (resp2.data as any).data.key;
      expect(key2).not.toBe(key1);
    });

    it('rotate nonexistent hash returns 404', async () => {
      const resp = await handleMockRequest({
        method: 'POST', path: '/keys/nonexistent/rotate', headers: AUTH_HEADER,
      });
      expect(resp.status).toBe(404);
    });

    it('rotate revoked key returns 410', async () => {
      const createResp = await handleMockRequest({
        method: 'POST', path: '/keys',
        body: { name: 'revoked-rotate' }, headers: AUTH_HEADER,
      });
      const hash = (createResp.data as any).data.hash;
      await handleMockRequest({ method: 'DELETE', path: `/keys/${hash}`, headers: AUTH_HEADER });

      const resp = await handleMockRequest({
        method: 'POST', path: `/keys/${hash}/rotate`, headers: AUTH_HEADER,
      });
      expect(resp.status).toBe(410);
    });

    it('rotate disabled key succeeds with disabled=true', async () => {
      const createResp = await handleMockRequest({
        method: 'POST', path: '/keys',
        body: { name: 'disabled-rotate' }, headers: AUTH_HEADER,
      });
      const hash = (createResp.data as any).data.hash;
      await handleMockRequest({
        method: 'PATCH', path: `/keys/${hash}`,
        body: { disabled: true }, headers: AUTH_HEADER,
      });

      const resp = await handleMockRequest({
        method: 'POST', path: `/keys/${hash}/rotate`, headers: AUTH_HEADER,
      });
      expect(resp.status).toBe(200);
      expect((resp.data as any).data.disabled).toBe(true);
    });

    it('rotate preserves name, credit_limit, limit_reset, usage, hash', async () => {
      const createResp = await handleMockRequest({
        method: 'POST', path: '/keys',
        body: { name: 'preserve-test', credit_limit: 100, limit_reset: 'weekly' }, headers: AUTH_HEADER,
      });
      const created = (createResp.data as any).data;

      const resp = await handleMockRequest({
        method: 'POST', path: `/keys/${created.hash}/rotate`, headers: AUTH_HEADER,
      });
      const rotated = (resp.data as any).data;
      expect(rotated.hash).toBe(created.hash);
      expect(rotated.name).toBe('preserve-test');
      expect(rotated.credit_limit).toBe(100);
      expect(rotated.limit_reset).toBe('weekly');
      expect(rotated.usage).toBe(0);
    });
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
