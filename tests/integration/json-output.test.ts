/**
 * Integration test: JSON output 格式驗證
 *
 * 測試策略：spy process.stdout.write，確認各 service 呼叫搭配 output({ json: true })
 * 會輸出合法的 JSON，且結構符合預期。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AuthService } from '../../src/services/auth.service.js';
import { CreditsService } from '../../src/services/credits.service.js';
import { KeysService } from '../../src/services/keys.service.js';
import { output } from '../../src/output/formatter.js';
import { mockStore } from '../../src/mock/store.js';

// 確保 mock handlers 已載入
import '../../src/mock/index.js';

const DEMO_TOKEN = 'sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function captureStdout(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    lines.push(String(chunk));
    return true;
  });
  return {
    lines,
    restore: () => {
      spy.mockRestore();
      void original; // suppress unused warning
    },
  };
}

describe('JSON output 格式', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-json-test-'));
    process.env.OPENCLAW_TOKEN_CONFIG_DIR = tmpDir;
    process.env.OPENCLAW_TOKEN_KEY = DEMO_TOKEN;
    mockStore.reset();
  });

  afterEach(async () => {
    delete process.env.OPENCLAW_TOKEN_CONFIG_DIR;
    delete process.env.OPENCLAW_TOKEN_KEY;
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('credits balance 輸出 valid JSON', async () => {
    const service = new CreditsService({ mock: true });
    const result = await service.balance(DEMO_TOKEN);

    const capture = captureStdout();
    output(result, { json: true });
    capture.restore();

    const combined = capture.lines.join('');
    const parsed = JSON.parse(combined);

    expect(parsed).toHaveProperty('total_credits');
    expect(parsed).toHaveProperty('total_usage');
    expect(parsed).toHaveProperty('remaining');
    expect(typeof parsed.total_credits).toBe('number');
  });

  it('credits buy 輸出 valid JSON', async () => {
    const service = new CreditsService({ mock: true });
    const result = await service.buy(DEMO_TOKEN, 10);

    const capture = captureStdout();
    output(result, { json: true });
    capture.restore();

    const parsed = JSON.parse(capture.lines.join(''));
    expect(parsed).toHaveProperty('transaction_id');
    expect(parsed).toHaveProperty('amount', 10);
    expect(parsed).toHaveProperty('new_balance');
    expect(parsed).toHaveProperty('platform_fee');
  });

  it('keys create 輸出 valid JSON', async () => {
    const service = new KeysService({ mock: true });
    const result = await service.create(DEMO_TOKEN, {
      name: 'json-test-key',
      credit_limit: null,
      limit_reset: null,
      expires_at: null,
    });

    const capture = captureStdout();
    output(result, { json: true });
    capture.restore();

    const parsed = JSON.parse(capture.lines.join(''));
    expect(parsed).toHaveProperty('key');
    expect(parsed).toHaveProperty('hash');
    expect(parsed).toHaveProperty('name', 'json-test-key');
    expect(parsed.key).toMatch(/^sk-prov-/);
  });

  it('keys list 輸出 valid JSON', async () => {
    const service = new KeysService({ mock: true });

    // 先建立 key
    await service.create(DEMO_TOKEN, { name: 'list-json-key', credit_limit: null, limit_reset: null, expires_at: null });

    const result = await service.list(DEMO_TOKEN);

    const capture = captureStdout();
    output(result, { json: true });
    capture.restore();

    const parsed = JSON.parse(capture.lines.join(''));
    expect(parsed).toHaveProperty('items');
    expect(Array.isArray(parsed.items)).toBe(true);
    expect(parsed.items[0]).toHaveProperty('name', 'list-json-key');
  });

  it('auth register 輸出 valid JSON', async () => {
    const service = new AuthService({ mock: true });
    const result = await service.register('json-test@test.com', 'JsonTest1!');

    const capture = captureStdout();
    output(result, { json: true });
    capture.restore();

    const parsed = JSON.parse(capture.lines.join(''));
    expect(parsed).toHaveProperty('management_key');
    expect(parsed).toHaveProperty('email', 'json-test@test.com');
    expect(parsed.management_key).toMatch(/^sk-mgmt-/);
  });

  it('credits history 輸出 valid JSON', async () => {
    const service = new CreditsService({ mock: true });

    // 先產生一筆 transaction
    await service.buy(DEMO_TOKEN, 5);

    const result = await service.history(DEMO_TOKEN);

    const capture = captureStdout();
    output(result, { json: true });
    capture.restore();

    const parsed = JSON.parse(capture.lines.join(''));
    expect(parsed).toHaveProperty('items');
    expect(parsed).toHaveProperty('total');
    expect(Array.isArray(parsed.items)).toBe(true);
    expect(parsed.items.length).toBeGreaterThan(0);
  });
});
