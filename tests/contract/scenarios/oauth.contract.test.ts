/**
 * Contract Test — OAuth Device Flow 場景
 *
 * 注意：Real 模式整體 skip。
 * Known difference: OAuth error format diverges
 * - mock 格式：{ error: { code, message } }
 * - real 格式：{ error: "...", error_description: "..." }（RFC 8628 標準格式）
 *
 * 涵蓋（mock only）：
 * - S13: POST /oauth/device/code → 200 + device_code, user_code 結構
 */

import { describe, it, expect } from 'vitest';
import { createContractClient } from '../harness/client.js';
import { assertSuccessEnvelope, assertHasFields } from '../helpers/assertions.js';

const client = createContractClient();

// Real 模式下整體 skip（OAuth error format 不一致，無法共用斷言）
// Known difference: OAuth error format diverges between mock and real server
const describeOrSkip = client.getMode() === 'real' ? describe.skip : describe;

describeOrSkip('OAuth Device Flow Contract Tests (mock only)', () => {
  // ---------------------------------------------------------------------------
  // S13: POST /oauth/device/code
  // ---------------------------------------------------------------------------
  describe('POST /oauth/device/code', () => {
    it('有效 client_id 應回傳 200 + device code 結構', async () => {
      const resp = await client.send('POST', '/oauth/device/code', {
        body: { client_id: 'test-client-id' },
      });

      expect(resp.status).toBe(200);
      assertSuccessEnvelope(resp.body);
      const data = resp.body.data;

      // 驗證 device code response 結構
      assertHasFields(data, [
        { name: 'device_code', type: 'string' },
        { name: 'user_code', type: 'string' },
        { name: 'verification_uri', type: 'string' },
        { name: 'interval', type: 'number' },
        { name: 'expires_in', type: 'number' },
      ]);
    });

    it('device_code 與 user_code 格式應正確', async () => {
      const resp = await client.send('POST', '/oauth/device/code', {
        body: { client_id: 'test-client-id-2' },
      });

      expect(resp.status).toBe(200);
      assertSuccessEnvelope(resp.body);
      const data = resp.body.data;

      // device_code 格式：dc_<hex>
      const deviceCode = data['device_code'] as string;
      expect(deviceCode).toMatch(/^dc_[0-9a-f]+$/);

      // user_code 格式：XXXX-XXXX
      const userCode = data['user_code'] as string;
      expect(userCode).toMatch(/^[A-Z]{4}-[A-Z]{4}$/);
    });

    it('缺少 client_id 應回傳 400', async () => {
      const resp = await client.send('POST', '/oauth/device/code', {
        body: {},
      });

      expect(resp.status).toBe(400);
    });
  });
});
