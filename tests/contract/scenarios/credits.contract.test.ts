/**
 * Contract Test — Credits 場景
 *
 * 涵蓋：
 * - S3: GET /credits（200）
 * - S4: POST /credits/purchase（200）
 * - S5: GET /credits/history（200）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createContractClient } from '../harness/client.js';
import {
  assertCreditsShape,
  assertCreditsPurchaseShape,
  assertCreditsHistoryShape,
  assertErrorEnvelope,
} from '../helpers/assertions.js';
import {
  createAuthenticatedContext,
  authHeader,
} from '../helpers/fixtures.js';

// 每個 test file 建立獨立 client（MockClient 使用獨立 store）
const client = createContractClient();

describe('Credits Contract Tests', () => {
  let managementKey: string;

  // 在所有測試前建立已驗證帳號
  beforeAll(async () => {
    const ctx = await createAuthenticatedContext(client);
    managementKey = ctx.managementKey;
  });

  // ---------------------------------------------------------------------------
  // S3: 查詢餘額
  // ---------------------------------------------------------------------------
  describe('GET /credits', () => {
    it('應回傳 200 + credits 結構', async () => {
      const resp = await client.send('GET', '/credits', {
        headers: authHeader(managementKey),
      });

      expect(resp.status).toBe(200);
      assertCreditsShape(resp.body);
    });

    it('無 token 應回傳 401', async () => {
      const resp = await client.send('GET', '/credits');

      expect(resp.status).toBe(401);
      assertErrorEnvelope(resp.body);
    });
  });

  // ---------------------------------------------------------------------------
  // S4: 購買 credits
  // ---------------------------------------------------------------------------
  describe('POST /credits/purchase', () => {
    it('有效金額應回傳 200 + purchase 結構', async () => {
      const resp = await client.send('POST', '/credits/purchase', {
        headers: authHeader(managementKey),
        body: { amount: 10 },
      });

      expect(resp.status).toBe(200);
      assertCreditsPurchaseShape(resp.body);

      // 驗證金額正確
      const data = (resp.body as { data: Record<string, unknown> }).data;
      expect(data['amount']).toBe(10);
    });

    it('購買後餘額應增加', async () => {
      // 購買前查詢餘額
      const beforeResp = await client.send('GET', '/credits', {
        headers: authHeader(managementKey),
      });
      const beforeData = (beforeResp.body as { data: Record<string, unknown> }).data;
      const beforeBalance = beforeData['remaining'] as number;

      // 購買 20 credits
      await client.send('POST', '/credits/purchase', {
        headers: authHeader(managementKey),
        body: { amount: 20 },
      });

      // 購買後查詢餘額
      const afterResp = await client.send('GET', '/credits', {
        headers: authHeader(managementKey),
      });
      const afterData = (afterResp.body as { data: Record<string, unknown> }).data;
      const afterBalance = afterData['remaining'] as number;

      // 餘額應增加（結構驗證，確認數字增加）
      expect(afterBalance).toBeGreaterThan(beforeBalance);
    });

    it('金額 < 5 應回傳 400', async () => {
      const resp = await client.send('POST', '/credits/purchase', {
        headers: authHeader(managementKey),
        body: { amount: 3 },
      });

      expect(resp.status).toBe(400);
      assertErrorEnvelope(resp.body);
    });
  });

  // ---------------------------------------------------------------------------
  // S5: 查詢歷史
  // ---------------------------------------------------------------------------
  describe('GET /credits/history', () => {
    beforeAll(async () => {
      // 確保有至少一筆 transaction
      await client.send('POST', '/credits/purchase', {
        headers: authHeader(managementKey),
        body: { amount: 5 },
      });
    });

    it('應回傳 200 + history 結構', async () => {
      const resp = await client.send('GET', '/credits/history', {
        headers: authHeader(managementKey),
      });

      expect(resp.status).toBe(200);
      assertCreditsHistoryShape(resp.body);
    });

    it('items 陣列元素應有必要欄位', async () => {
      const resp = await client.send('GET', '/credits/history', {
        headers: authHeader(managementKey),
      });

      assertCreditsHistoryShape(resp.body);
      const data = (resp.body as { data: Record<string, unknown> }).data;
      const items = data['items'] as Array<Record<string, unknown>>;

      // 有 transaction 時驗證元素結構
      if (items.length > 0) {
        const item = items[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('amount');
        expect(item).toHaveProperty('balance_after');
        expect(item).toHaveProperty('created_at');
      }
    });
  });
});
