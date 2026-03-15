/**
 * Contract Test — Idempotency（冪等性）場景
 *
 * 涵蓋：
 * - S14: 相同 Idempotency-Key 重複 POST /credits/purchase → 200 + 同一 transaction_id
 */

import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { createContractClient } from '../harness/client.js';
import { assertCreditsPurchaseShape } from '../helpers/assertions.js';
import { createAuthenticatedContext, authHeader } from '../helpers/fixtures.js';

// 每個 test file 建立獨立 client（MockClient 使用獨立 store）
const client = createContractClient();

describe('Idempotency Contract Tests', () => {
  let managementKey: string;

  // 建立已驗證帳號
  beforeAll(async () => {
    const ctx = await createAuthenticatedContext(client);
    managementKey = ctx.managementKey;
  });

  // ---------------------------------------------------------------------------
  // S14: 冪等性購買
  // ---------------------------------------------------------------------------
  describe('POST /credits/purchase — Idempotency-Key', () => {
    it('相同 Idempotency-Key 重複呼叫應回傳相同 transaction_id', async () => {
      // 生成唯一的 idempotency key
      const idempotencyKey = `idem-${crypto.randomUUID()}`;

      // 第一次購買
      const firstResp = await client.send('POST', '/credits/purchase', {
        headers: {
          ...authHeader(managementKey),
          'Idempotency-Key': idempotencyKey,
        },
        body: { amount: 10 },
      });

      expect(firstResp.status).toBe(200);
      assertCreditsPurchaseShape(firstResp.body);
      const firstData = (firstResp.body as { data: Record<string, unknown> }).data;
      const firstTransactionId = firstData['transaction_id'] as string;

      // 第二次相同 Idempotency-Key 購買
      const secondResp = await client.send('POST', '/credits/purchase', {
        headers: {
          ...authHeader(managementKey),
          'Idempotency-Key': idempotencyKey,
        },
        body: { amount: 10 },
      });

      expect(secondResp.status).toBe(200);
      assertCreditsPurchaseShape(secondResp.body);
      const secondData = (secondResp.body as { data: Record<string, unknown> }).data;
      const secondTransactionId = secondData['transaction_id'] as string;

      // 關鍵：兩次回傳相同的 transaction_id
      expect(secondTransactionId).toBe(firstTransactionId);
    });

    it('不同 Idempotency-Key 應產生不同 transaction_id', async () => {
      const idempotencyKey1 = `idem-${crypto.randomUUID()}`;
      const idempotencyKey2 = `idem-${crypto.randomUUID()}`;

      const resp1 = await client.send('POST', '/credits/purchase', {
        headers: {
          ...authHeader(managementKey),
          'Idempotency-Key': idempotencyKey1,
        },
        body: { amount: 5 },
      });

      const resp2 = await client.send('POST', '/credits/purchase', {
        headers: {
          ...authHeader(managementKey),
          'Idempotency-Key': idempotencyKey2,
        },
        body: { amount: 5 },
      });

      expect(resp1.status).toBe(200);
      expect(resp2.status).toBe(200);

      const txId1 = (resp1.body as { data: Record<string, unknown> }).data['transaction_id'];
      const txId2 = (resp2.body as { data: Record<string, unknown> }).data['transaction_id'];

      // 不同的請求應產生不同的 transaction_id
      expect(txId1).not.toBe(txId2);
    });
  });
});
