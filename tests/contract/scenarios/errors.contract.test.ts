/**
 * Contract Test — Error 場景
 *
 * 涵蓋：
 * - S11: 401 認證錯誤（無 token、無效 token）
 * - S12: 400 輸入驗證錯誤（缺少必要欄位、金額不足）
 * - 409: 重複 email 衝突
 */

import { describe, it, expect } from 'vitest';
import { createContractClient } from '../harness/client.js';
import { assertErrorEnvelope } from '../helpers/assertions.js';
import { generateUniqueEmail, TEST_PASSWORD } from '../helpers/fixtures.js';

// 每個 test file 建立獨立 client（MockClient 使用獨立 store）
const client = createContractClient();

describe('Error Scenarios Contract Tests', () => {
  // ---------------------------------------------------------------------------
  // S11: 認證錯誤（401）
  // ---------------------------------------------------------------------------
  describe('401 Unauthorized', () => {
    it('無 token 呼叫 GET /credits 應回傳 401 + error envelope', async () => {
      const resp = await client.send('GET', '/credits');

      expect(resp.status).toBe(401);
      assertErrorEnvelope(resp.body);
    });

    it('無效 token 呼叫 GET /credits 應回傳 401', async () => {
      const resp = await client.send('GET', '/credits', {
        headers: { Authorization: 'Bearer sk-mgmt-invalid-token-format' },
      });

      expect(resp.status).toBe(401);
      assertErrorEnvelope(resp.body);
    });

    it('無 token 呼叫 GET /auth/me 應回傳 401', async () => {
      const resp = await client.send('GET', '/auth/me');

      expect(resp.status).toBe(401);
      assertErrorEnvelope(resp.body);
    });

    it('無 token 呼叫 GET /keys 應回傳 401', async () => {
      const resp = await client.send('GET', '/keys');

      expect(resp.status).toBe(401);
      assertErrorEnvelope(resp.body);
    });
  });

  // ---------------------------------------------------------------------------
  // S12: 輸入驗證錯誤（400）
  // ---------------------------------------------------------------------------
  describe('400 Bad Request', () => {
    it('register 缺少 email 應回傳 400 + error envelope', async () => {
      const resp = await client.send('POST', '/auth/register', {
        body: { password: TEST_PASSWORD },
      });

      expect(resp.status).toBe(400);
      assertErrorEnvelope(resp.body);
    });

    it('register 缺少 password 應回傳 400', async () => {
      const resp = await client.send('POST', '/auth/register', {
        body: { email: generateUniqueEmail() },
      });

      expect(resp.status).toBe(400);
      assertErrorEnvelope(resp.body);
    });

    it('purchase amount < 5 應回傳 400', async () => {
      // 先建立帳號取得 token
      const email = generateUniqueEmail();
      const regResp = await client.send('POST', '/auth/register', {
        body: { email, password: TEST_PASSWORD },
      });
      const managementKey = (
        regResp.body as { data: { management_key: string } }
      ).data.management_key;

      // 嘗試購買不足 $5 的金額
      const resp = await client.send('POST', '/credits/purchase', {
        headers: { Authorization: `Bearer ${managementKey}` },
        body: { amount: 3 },
      });

      expect(resp.status).toBe(400);
      assertErrorEnvelope(resp.body);
    });

    it('purchase amount = 0 應回傳 400', async () => {
      // 先建立帳號取得 token
      const email = generateUniqueEmail();
      const regResp = await client.send('POST', '/auth/register', {
        body: { email, password: TEST_PASSWORD },
      });
      const managementKey = (
        regResp.body as { data: { management_key: string } }
      ).data.management_key;

      const resp = await client.send('POST', '/credits/purchase', {
        headers: { Authorization: `Bearer ${managementKey}` },
        body: { amount: 0 },
      });

      expect(resp.status).toBe(400);
      assertErrorEnvelope(resp.body);
    });
  });

  // ---------------------------------------------------------------------------
  // 409 Conflict：重複 email
  // ---------------------------------------------------------------------------
  describe('409 Conflict', () => {
    it('重複 register 應回傳 409 + error envelope', async () => {
      const email = generateUniqueEmail();

      // 第一次 register
      const firstResp = await client.send('POST', '/auth/register', {
        body: { email, password: TEST_PASSWORD },
      });
      expect(firstResp.status).toBe(201);

      // 第二次相同 email
      const secondResp = await client.send('POST', '/auth/register', {
        body: { email, password: TEST_PASSWORD },
      });

      expect(secondResp.status).toBe(409);
      assertErrorEnvelope(secondResp.body);
    });
  });
});
