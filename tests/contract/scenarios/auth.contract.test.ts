/**
 * Contract Test — Auth 場景
 *
 * 涵蓋：
 * - S1: POST /auth/register（201）
 * - S1: POST /auth/login（200）
 * - S2: GET /auth/me（200）
 * - 管理金鑰輪換：POST /auth/rotate
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createContractClient } from '../harness/client.js';
import {
  assertAuthRegisterShape,
  assertAuthLoginShape,
  assertAuthMeShape,
  assertErrorEnvelope,
} from '../helpers/assertions.js';
import { generateUniqueEmail, TEST_PASSWORD, authHeader } from '../helpers/fixtures.js';

// 每個 test file 建立獨立 client（MockClient 使用獨立 store）
const client = createContractClient();

describe('Auth Contract Tests', () => {
  // ---------------------------------------------------------------------------
  // S1: 註冊
  // ---------------------------------------------------------------------------
  describe('POST /auth/register', () => {
    it('應回傳 201 並包含 management_key', async () => {
      const email = generateUniqueEmail();

      const resp = await client.send('POST', '/auth/register', {
        body: { email, password: TEST_PASSWORD },
      });

      expect(resp.status).toBe(201);
      assertAuthRegisterShape(resp.body);

      // 驗證 email 正確回傳
      const data = (resp.body as { data: Record<string, unknown> }).data;
      expect(data['email']).toBe(email);
    });

    it('重複 email 應回傳 409 + error envelope', async () => {
      const email = generateUniqueEmail();

      // 第一次 register
      await client.send('POST', '/auth/register', {
        body: { email, password: TEST_PASSWORD },
      });

      // 第二次相同 email
      const resp = await client.send('POST', '/auth/register', {
        body: { email, password: TEST_PASSWORD },
      });

      expect(resp.status).toBe(409);
      assertErrorEnvelope(resp.body);
    });

    it('缺少 email 應回傳 400', async () => {
      const resp = await client.send('POST', '/auth/register', {
        body: { password: TEST_PASSWORD },
      });

      expect(resp.status).toBe(400);
      assertErrorEnvelope(resp.body);
    });
  });

  // ---------------------------------------------------------------------------
  // S1: 登入
  // ---------------------------------------------------------------------------
  describe('POST /auth/login', () => {
    let registeredEmail: string;

    beforeAll(async () => {
      // 先建立帳號
      registeredEmail = generateUniqueEmail();
      await client.send('POST', '/auth/register', {
        body: { email: registeredEmail, password: TEST_PASSWORD },
      });
    });

    it('正確憑證應回傳 200 + management_key', async () => {
      const resp = await client.send('POST', '/auth/login', {
        body: { email: registeredEmail, password: TEST_PASSWORD },
      });

      expect(resp.status).toBe(200);
      assertAuthLoginShape(resp.body);

      const data = (resp.body as { data: Record<string, unknown> }).data;
      expect(data['email']).toBe(registeredEmail);
    });

    it('錯誤密碼應回傳 401', async () => {
      const resp = await client.send('POST', '/auth/login', {
        body: { email: registeredEmail, password: 'WrongPassword123!' },
      });

      expect(resp.status).toBe(401);
      assertErrorEnvelope(resp.body);
    });
  });

  // ---------------------------------------------------------------------------
  // S2: 查詢帳戶資訊
  // ---------------------------------------------------------------------------
  describe('GET /auth/me', () => {
    let managementKey: string;
    let registeredEmail: string;

    beforeAll(async () => {
      registeredEmail = generateUniqueEmail();
      const resp = await client.send('POST', '/auth/register', {
        body: { email: registeredEmail, password: TEST_PASSWORD },
      });
      const data = (resp.body as { data: { management_key: string } }).data;
      managementKey = data.management_key;
    });

    it('有效 token 應回傳 200 + 帳戶資訊', async () => {
      const resp = await client.send('GET', '/auth/me', {
        headers: authHeader(managementKey),
      });

      expect(resp.status).toBe(200);
      assertAuthMeShape(resp.body);

      const data = (resp.body as { data: Record<string, unknown> }).data;
      expect(data['email']).toBe(registeredEmail);
    });

    it('無 token 應回傳 401', async () => {
      const resp = await client.send('GET', '/auth/me');

      expect(resp.status).toBe(401);
      assertErrorEnvelope(resp.body);
    });
  });

  // ---------------------------------------------------------------------------
  // 管理金鑰輪換
  // ---------------------------------------------------------------------------
  describe('POST /auth/rotate', () => {
    it('輪換後新 key 可用，舊 key 回傳 401', async () => {
      // 建立新帳號
      const email = generateUniqueEmail();
      const regResp = await client.send('POST', '/auth/register', {
        body: { email, password: TEST_PASSWORD },
      });
      const oldKey = (regResp.body as { data: { management_key: string } }).data.management_key;

      // 輪換 key
      const rotateResp = await client.send('POST', '/auth/rotate', {
        headers: authHeader(oldKey),
      });

      expect(rotateResp.status).toBe(200);
      const rotateData = (rotateResp.body as { data: { management_key: string } }).data;
      const newKey = rotateData.management_key;

      // 新 key 應可正常呼叫
      const meResp = await client.send('GET', '/auth/me', {
        headers: authHeader(newKey),
      });
      expect(meResp.status).toBe(200);

      // 舊 key 應回傳 401（已被撤銷）
      const oldResp = await client.send('GET', '/auth/me', {
        headers: authHeader(oldKey),
      });
      expect(oldResp.status).toBe(401);
    });
  });
});
