import { describe, it, expect, beforeEach } from 'vitest';
import { mockStore } from '../../../../src/mock/store.js';
import { handleMockRequest } from '../../../../src/mock/index.js';

const AUTH_HEADER = { Authorization: 'Bearer sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890' };

describe('Credits Mock Handlers', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  it('GET /credits returns balance', async () => {
    const resp = await handleMockRequest({ method: 'GET', path: '/credits', headers: AUTH_HEADER });
    expect(resp.status).toBe(200);
    const data = (resp.data as any).data;
    expect(data.total_credits).toBe(100);
    expect(data.remaining).toBe(100);
  });

  it('POST /credits/purchase calculates platform fee', async () => {
    const resp = await handleMockRequest({
      method: 'POST', path: '/credits/purchase',
      body: { amount: 25 }, headers: AUTH_HEADER,
    });
    expect(resp.status).toBe(200);
    const data = (resp.data as any).data;
    expect(data.amount).toBe(25);
    expect(data.platform_fee).toBe(1.38); // max(25*0.055, 0.80) = 1.375 → 1.38
    expect(data.new_balance).toBe(125); // 100 + 25
  });

  it('POST /credits/purchase supports idempotency', async () => {
    const headers = { ...AUTH_HEADER, 'Idempotency-Key': 'test-idem-key' };
    const resp1 = await handleMockRequest({
      method: 'POST', path: '/credits/purchase',
      body: { amount: 10 }, headers,
    });
    const resp2 = await handleMockRequest({
      method: 'POST', path: '/credits/purchase',
      body: { amount: 10 }, headers,
    });
    expect((resp1.data as any).data.transaction_id).toBe((resp2.data as any).data.transaction_id);
  });

  it('GET /credits/history returns transactions', async () => {
    // First make a purchase
    await handleMockRequest({
      method: 'POST', path: '/credits/purchase',
      body: { amount: 10 }, headers: AUTH_HEADER,
    });

    const resp = await handleMockRequest({
      method: 'GET', path: '/credits/history', headers: AUTH_HEADER,
    });
    expect(resp.status).toBe(200);
    const data = (resp.data as any).data;
    expect(data.items.length).toBe(1);
    expect(data.items[0].type).toBe('purchase');
  });

  it('GET/PUT /credits/auto-topup CRUD', async () => {
    // Get default
    let resp = await handleMockRequest({ method: 'GET', path: '/credits/auto-topup', headers: AUTH_HEADER });
    expect((resp.data as any).data.enabled).toBe(false);

    // Update
    resp = await handleMockRequest({
      method: 'PUT', path: '/credits/auto-topup',
      body: { enabled: true, threshold: 10, amount: 50 }, headers: AUTH_HEADER,
    });
    expect(resp.status).toBe(200);
    expect((resp.data as any).data.enabled).toBe(true);
    expect((resp.data as any).data.threshold).toBe(10);
  });
});
