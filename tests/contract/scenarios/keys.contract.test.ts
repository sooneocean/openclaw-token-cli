/**
 * Contract Test — Keys 場景
 *
 * 涵蓋：
 * - S6:  POST /keys（201）
 * - S7:  GET /keys（200）
 * - S8:  GET /keys/:hash（200）
 * - S9:  PATCH /keys/:hash（200）
 * - S10: DELETE /keys/:hash（200）
 * - Key rotate：POST /keys/:hash/rotate（200）
 *
 * Known drift：
 * - PATCH /keys/:hash response 可能含 updated_at（mock 有，real 無）→ 不驗此欄位
 * - GET /keys/:hash 的 usage_weekly 係數差異 → 只驗型別 number
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createContractClient } from '../harness/client.js';
import {
  assertKeyCreateShape,
  assertKeysListShape,
  assertKeyDetailShape,
  assertSuccessEnvelope,
  assertHasFields,
} from '../helpers/assertions.js';
import {
  createAuthenticatedContext,
  authHeader,
  TEST_KEY_NAME,
} from '../helpers/fixtures.js';

// 每個 test file 建立獨立 client（MockClient 使用獨立 store）
const client = createContractClient();

describe('Keys Contract Tests', () => {
  let managementKey: string;
  let createdKeyHash: string;

  // 建立已驗證帳號
  beforeAll(async () => {
    const ctx = await createAuthenticatedContext(client);
    managementKey = ctx.managementKey;
  });

  // ---------------------------------------------------------------------------
  // S6: 建立 key
  // ---------------------------------------------------------------------------
  describe('POST /keys', () => {
    it('應回傳 201 + key 結構', async () => {
      const resp = await client.send('POST', '/keys', {
        headers: authHeader(managementKey),
        body: { name: TEST_KEY_NAME },
      });

      expect(resp.status).toBe(201);
      assertKeyCreateShape(resp.body);

      // 儲存 hash 供後續測試使用
      const data = (resp.body as { data: Record<string, unknown> }).data;
      createdKeyHash = data['hash'] as string;
      expect(createdKeyHash).toBeTruthy();
    });

    it('缺少 name 應回傳 400', async () => {
      const resp = await client.send('POST', '/keys', {
        headers: authHeader(managementKey),
        body: {},
      });

      expect(resp.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // S7: 列出 keys
  // ---------------------------------------------------------------------------
  describe('GET /keys', () => {
    it('應回傳 200 + keys list 結構', async () => {
      const resp = await client.send('GET', '/keys', {
        headers: authHeader(managementKey),
      });

      expect(resp.status).toBe(200);
      assertKeysListShape(resp.body);
    });

    it('建立 key 後 list 應包含該 key', async () => {
      const resp = await client.send('GET', '/keys', {
        headers: authHeader(managementKey),
      });

      assertKeysListShape(resp.body);
      const data = (resp.body as { data: Record<string, unknown> }).data;
      const items = data['items'] as Array<Record<string, unknown>>;

      // 應能找到剛建立的 key（以 hash 比對）
      const found = items.some((k) => k['hash'] === createdKeyHash);
      expect(found, `list 應包含 hash=${createdKeyHash} 的 key`).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // S8: 查詢 key 詳情
  // ---------------------------------------------------------------------------
  describe('GET /keys/:hash', () => {
    it('應回傳 200 + key detail 結構', async () => {
      const resp = await client.send(`GET`, `/keys/${createdKeyHash}`, {
        headers: authHeader(managementKey),
      });

      expect(resp.status).toBe(200);
      // assertKeyDetailShape 已處理 usage_weekly 只驗 number 的 drift
      assertKeyDetailShape(resp.body);
    });

    it('usage_weekly 應為 number（不驗精確值，known drift）', async () => {
      const resp = await client.send(`GET`, `/keys/${createdKeyHash}`, {
        headers: authHeader(managementKey),
      });

      assertSuccessEnvelope(resp.body);
      const data = resp.body.data;
      expect(typeof data['usage_weekly']).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  // S9: 更新 key
  // ---------------------------------------------------------------------------
  describe('PATCH /keys/:hash', () => {
    it('應回傳 200 + updated key 結構', async () => {
      const resp = await client.send(`PATCH`, `/keys/${createdKeyHash}`, {
        headers: authHeader(managementKey),
        body: { disabled: true },
      });

      expect(resp.status).toBe(200);
      assertSuccessEnvelope(resp.body);
      const data = resp.body.data;

      // 驗證基本欄位（不驗 updated_at，已知 drift：mock 有 real 無）
      assertHasFields(data, [
        { name: 'hash', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'disabled', type: 'boolean' },
      ]);

      // 驗證 disabled 已被更新
      expect(data['disabled']).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Key Rotate
  // ---------------------------------------------------------------------------
  describe('POST /keys/:hash/rotate', () => {
    it('輪換後應回傳新 key 值', async () => {
      // 先建立一個新 key 用於輪換測試
      const createResp = await client.send('POST', '/keys', {
        headers: authHeader(managementKey),
        body: { name: 'rotate-test-key' },
      });
      expect(createResp.status).toBe(201);
      const createData = (createResp.body as { data: Record<string, unknown> }).data;
      const keyHash = createData['hash'] as string;
      const originalKeyValue = createData['key'] as string;

      // 輪換
      const rotateResp = await client.send(`POST`, `/keys/${keyHash}/rotate`, {
        headers: authHeader(managementKey),
      });

      expect(rotateResp.status).toBe(200);
      assertSuccessEnvelope(rotateResp.body);
      const rotateData = rotateResp.body.data;

      // 新 key 值應存在且不同於原始值
      expect(rotateData).toHaveProperty('key');
      expect(typeof rotateData['key']).toBe('string');
      expect(rotateData['key']).not.toBe(originalKeyValue);
      // hash 不變
      expect(rotateData['hash']).toBe(keyHash);
    });
  });

  // ---------------------------------------------------------------------------
  // S10: 撤銷 key
  // ---------------------------------------------------------------------------
  describe('DELETE /keys/:hash', () => {
    it('應回傳 200 + revoke 結構', async () => {
      // 建立一個 key 用於撤銷測試
      const createResp = await client.send('POST', '/keys', {
        headers: authHeader(managementKey),
        body: { name: 'revoke-test-key' },
      });
      expect(createResp.status).toBe(201);
      const createData = (createResp.body as { data: Record<string, unknown> }).data;
      const keyHash = createData['hash'] as string;

      // 撤銷
      const revokeResp = await client.send(`DELETE`, `/keys/${keyHash}`, {
        headers: authHeader(managementKey),
      });

      expect(revokeResp.status).toBe(200);
      assertSuccessEnvelope(revokeResp.body);
      const revokeData = revokeResp.body.data;

      // 驗證回應結構
      assertHasFields(revokeData, [
        { name: 'hash', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'revoked', type: 'boolean' },
        { name: 'revoked_at', type: 'string' },
      ]);
      expect(revokeData['revoked']).toBe(true);
    });
  });
});
