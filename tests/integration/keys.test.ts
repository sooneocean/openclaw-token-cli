/**
 * Integration test: Keys flow
 *
 * 測試策略：使用 KeysService + mock 模式，完整走 create → list → info → update → revoke 流程。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { KeysService } from '../../src/services/keys.service.js';
import { mockStore } from '../../src/mock/store.js';

// 確保 mock handlers 已載入
import '../../src/mock/index.js';

const DEMO_TOKEN = 'sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('Keys 完整流程', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-integration-'));
    process.env.OPENCLAW_TOKEN_CONFIG_DIR = tmpDir;
    process.env.OPENCLAW_TOKEN_KEY = DEMO_TOKEN;
    mockStore.reset();
  });

  afterEach(async () => {
    delete process.env.OPENCLAW_TOKEN_CONFIG_DIR;
    delete process.env.OPENCLAW_TOKEN_KEY;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('create → list → info → update → revoke 完整流程', async () => {
    const service = new KeysService({ mock: true });

    // --- list（初始空）---
    const emptyList = await service.list(DEMO_TOKEN);
    expect(emptyList.items).toHaveLength(0);

    // --- create ---
    const createResult = await service.create(DEMO_TOKEN, {
      name: 'test-key',
      credit_limit: 50,
      limit_reset: 'monthly',
      expires_at: null,
    });
    expect(createResult.key).toMatch(/^sk-prov-/);
    expect(createResult.hash).toMatch(/^hash_/);
    expect(createResult.name).toBe('test-key');
    expect(createResult.credit_limit).toBe(50);
    expect(createResult.limit_reset).toBe('monthly');

    const keyHash = createResult.hash;

    // --- list（有一個 key）---
    const list = await service.list(DEMO_TOKEN);
    expect(list.items).toHaveLength(1);
    expect(list.items[0].name).toBe('test-key');
    expect(list.items[0].hash).toBe(keyHash);

    // --- info ---
    const info = await service.info(DEMO_TOKEN, keyHash);
    expect(info.hash).toBe(keyHash);
    expect(info.name).toBe('test-key');
    expect(info.credit_limit).toBe(50);
    expect(info.disabled).toBe(false);
    expect(info.usage).toBe(0);

    // --- update ---
    const updated = await service.update(DEMO_TOKEN, keyHash, { disabled: true, credit_limit: 100 });
    expect(updated.disabled).toBe(true);
    expect(updated.credit_limit).toBe(100);

    // --- revoke ---
    const revokeResult = await service.revoke(DEMO_TOKEN, keyHash);
    expect(revokeResult.hash).toBe(keyHash);
    expect(revokeResult.revoked).toBe(true);

    // --- list 後（revoked key 不出現）---
    const listAfterRevoke = await service.list(DEMO_TOKEN);
    expect(listAfterRevoke.items).toHaveLength(0);
  });

  it('建立重複名稱 key 應拋出 409 錯誤', async () => {
    const service = new KeysService({ mock: true });

    await service.create(DEMO_TOKEN, { name: 'duplicate-key', credit_limit: null, limit_reset: null, expires_at: null });
    await expect(
      service.create(DEMO_TOKEN, { name: 'duplicate-key', credit_limit: null, limit_reset: null, expires_at: null })
    ).rejects.toThrow('conflict');
  });

  it('revoke 已撤銷 key 應拋出 410 錯誤', async () => {
    const service = new KeysService({ mock: true });

    const created = await service.create(DEMO_TOKEN, { name: 'one-time', credit_limit: null, limit_reset: null, expires_at: null });
    await service.revoke(DEMO_TOKEN, created.hash);

    await expect(service.revoke(DEMO_TOKEN, created.hash)).rejects.toThrow('revoked');
  });

  it('多個 key 並存，list 全部列出', async () => {
    const service = new KeysService({ mock: true });

    await service.create(DEMO_TOKEN, { name: 'key-alpha', credit_limit: null, limit_reset: null, expires_at: null });
    await service.create(DEMO_TOKEN, { name: 'key-beta', credit_limit: null, limit_reset: null, expires_at: null });
    await service.create(DEMO_TOKEN, { name: 'key-gamma', credit_limit: null, limit_reset: null, expires_at: null });

    const list = await service.list(DEMO_TOKEN);
    expect(list.items).toHaveLength(3);
    const names = list.items.map((k) => k.name);
    expect(names).toContain('key-alpha');
    expect(names).toContain('key-beta');
    expect(names).toContain('key-gamma');
  });
});
