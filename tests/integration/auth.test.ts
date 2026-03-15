/**
 * Integration test: Auth flow
 *
 * 測試策略：直接透過 AuthService 呼叫，使用 mock 模式 + temp config dir 隔離。
 * 這確保整個 register → whoami → logout → login 流程都使用 MockStore。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AuthService } from '../../src/services/auth.service.js';
import { ConfigManager } from '../../src/config/manager.js';
import { mockStore } from '../../src/mock/store.js';

// 確保 mock handlers 已載入
import '../../src/mock/index.js';

describe('Auth 完整流程', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-integration-'));
    process.env.OPENCLAW_TOKEN_CONFIG_DIR = tmpDir;
    mockStore.reset();
  });

  afterEach(async () => {
    delete process.env.OPENCLAW_TOKEN_CONFIG_DIR;
    delete process.env.OPENCLAW_TOKEN_KEY;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('register → whoami → logout → login 完整流程', async () => {
    const service = new AuthService({ mock: true });
    const email = 'integration@test.com';
    const password = 'Integration1!';

    // --- register ---
    const registerResult = await service.register(email, password);
    expect(registerResult.email).toBe(email);
    expect(registerResult.management_key).toMatch(/^sk-mgmt-/);

    // config 應已寫入
    const config = await ConfigManager.read();
    expect(config).not.toBeNull();
    expect(config!.email).toBe(email);
    expect(config!.management_key).toBe(registerResult.management_key);

    // --- whoami ---
    // 注意：MockStore 使用無狀態 demo 帳號策略，任何合法格式的 token 都映射到
    // demo@openclaw.dev。這是設計上的取捨，讓 mock 可以無 DB 運作。
    const meResult = await service.whoami(registerResult.management_key);
    expect(meResult.email).toBeTruthy(); // 有效回應
    expect(meResult.plan).toBe('free');
    expect(typeof meResult.credits_remaining).toBe('number');

    // --- logout ---
    await service.logout();
    expect(await ConfigManager.exists()).toBe(false);

    // --- login ---
    const loginResult = await service.login(email, password);
    expect(loginResult.email).toBe(email);
    expect(loginResult.management_key).toMatch(/^sk-mgmt-/);

    // config 應重新寫入
    const configAfterLogin = await ConfigManager.read();
    expect(configAfterLogin).not.toBeNull();
    expect(configAfterLogin!.email).toBe(email);
  });

  it('重複 register 相同 email 應拋出 409 錯誤', async () => {
    const service = new AuthService({ mock: true });
    const email = 'demo@openclaw.dev'; // mockStore 預設已有這個帳號

    await expect(service.register(email, 'Password1!')).rejects.toThrow('conflict');
  });

  it('login 密碼錯誤應拋出 401 錯誤', async () => {
    const service = new AuthService({ mock: true });
    await expect(service.login('demo@openclaw.dev', 'WrongPassword1!')).rejects.toThrow('Session expired');
  });

  describe('auth rotate', () => {
    it('rotate 後 config 更新為新 key', async () => {
      const service = new AuthService({ mock: true });
      const loginResult = await service.login('demo@openclaw.dev', 'Demo1234!');

      const rotateResult = await service.rotate(loginResult.management_key);
      expect(rotateResult.management_key).toMatch(/^sk-mgmt-/);
      expect(rotateResult.management_key).not.toBe(loginResult.management_key);

      const config = await ConfigManager.read();
      expect(config!.management_key).toBe(rotateResult.management_key);
    });

    it('rotate 後新 key 可用於 whoami', async () => {
      const service = new AuthService({ mock: true });
      const loginResult = await service.login('demo@openclaw.dev', 'Demo1234!');

      const rotateResult = await service.rotate(loginResult.management_key);
      const me = await service.whoami(rotateResult.management_key);
      expect(me.email).toBe('demo@openclaw.dev');
    });

    it('rotate --json 格式正確', async () => {
      const service = new AuthService({ mock: true });
      const loginResult = await service.login('demo@openclaw.dev', 'Demo1234!');

      const result = await service.rotate(loginResult.management_key);
      expect(result).toHaveProperty('management_key');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('rotated_at');
    });
  });
});
