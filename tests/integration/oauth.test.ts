/**
 * Integration test: OAuth flow
 *
 * 測試策略：直接透過 OAuthService 呼叫，使用 mock 模式 + temp config dir 隔離。
 * 透過修改 mockStore.oauthSessions.set 將 auto_authorize_at 設為過去，使 poll 立即成功。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OAuthService } from '../../src/services/oauth.service.js';
import { AuthService } from '../../src/services/auth.service.js';
import { ConfigManager } from '../../src/config/manager.js';
import { mockStore } from '../../src/mock/store.js';

// Ensure mock handlers are registered
import '../../src/mock/index.js';

describe('OAuth 完整流程', () => {
  let tmpDir: string;
  const noopSleep = () => Promise.resolve();

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-oauth-integration-'));
    process.env.OPENCLAW_TOKEN_CONFIG_DIR = tmpDir;
    mockStore.reset();
  });

  afterEach(async () => {
    delete process.env.OPENCLAW_TOKEN_CONFIG_DIR;
    delete process.env.OPENCLAW_TOKEN_KEY;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // 1. New user GitHub login full flow
  it('GitHub 登入完整流程（新用戶）', async () => {
    const service = new OAuthService({ mock: true, sleepFn: noopSleep });

    // Set auto_authorize_at to past for all new sessions
    const origSet = mockStore.oauthSessions.set.bind(mockStore.oauthSessions);
    mockStore.oauthSessions.set = (key, value) => {
      value.auto_authorize_at = Date.now() - 1;
      return origSet(key, value);
    };

    const result = await service.loginWithGitHub();

    expect(result.email).toBe('github-user@example.com');
    expect(result.management_key).toMatch(/^sk-mgmt-/);
    expect(result.merged).toBe(false);

    // Verify config was written
    const config = await ConfigManager.read();
    expect(config).not.toBeNull();
    expect(config!.management_key).toBe(result.management_key);
    expect(config!.email).toBe(result.email);
    expect(config!.api_base).toMatch(/^https?:\/\//);
    expect(config!.last_login).toBeTruthy();
    expect(config!.created_at).toBeTruthy();

    // Restore
    mockStore.oauthSessions.set = origSet;
  });

  // 2. Account merge: register email/password first, then OAuth with same email
  it('帳號合併：先 register 再 OAuth 同 email', async () => {
    const email = 'github-user@example.com';

    // Step 1: Register with email/password
    const authService = new AuthService({ mock: true });
    const registerResult = await authService.register(email, 'Test1234!');
    const originalKey = registerResult.management_key;

    // Step 2: OAuth login with same email
    const oauthService = new OAuthService({ mock: true, sleepFn: noopSleep });

    const origSet = mockStore.oauthSessions.set.bind(mockStore.oauthSessions);
    mockStore.oauthSessions.set = (key, value) => {
      value.auto_authorize_at = Date.now() - 1;
      return origSet(key, value);
    };

    const result = await oauthService.loginWithGitHub();

    expect(result.merged).toBe(true);
    expect(result.management_key).toBe(originalKey); // Same key!
    expect(result.email).toBe(email);

    // User should now have oauth_provider
    const user = mockStore.users.get(email);
    expect(user?.oauth_provider).toBe('github');

    mockStore.oauthSessions.set = origSet;
  });

  // 3. GitHub login then whoami
  it('GitHub 登入後 whoami 正常', async () => {
    const oauthService = new OAuthService({ mock: true, sleepFn: noopSleep });

    const origSet = mockStore.oauthSessions.set.bind(mockStore.oauthSessions);
    mockStore.oauthSessions.set = (key, value) => {
      value.auto_authorize_at = Date.now() - 1;
      return origSet(key, value);
    };

    const loginResult = await oauthService.loginWithGitHub();

    // Now whoami should work
    const authService = new AuthService({ mock: true });
    const meResult = await authService.whoami(loginResult.management_key);
    expect(meResult.email).toBeTruthy();
    expect(meResult.plan).toBe('free');

    mockStore.oauthSessions.set = origSet;
  });

  // 4. --json output would be valid JSON (we test the service returns structured data)
  it('loginWithGitHub 返回結構化資料（可用於 --json 輸出）', async () => {
    const service = new OAuthService({ mock: true, sleepFn: noopSleep });

    const origSet = mockStore.oauthSessions.set.bind(mockStore.oauthSessions);
    mockStore.oauthSessions.set = (key, value) => {
      value.auto_authorize_at = Date.now() - 1;
      return origSet(key, value);
    };

    const result = await service.loginWithGitHub();

    // Verify JSON.stringify works and has expected fields
    const json = JSON.parse(JSON.stringify(result));
    expect(json.email).toBe('github-user@example.com');
    expect(json.management_key).toMatch(/^sk-mgmt-/);
    expect(typeof json.merged).toBe('boolean');

    mockStore.oauthSessions.set = origSet;
  });

  // 5. Password login still works after OAuth merge
  it('合併後 password login 仍有效', async () => {
    const email = 'github-user@example.com';
    const password = 'Test1234!';

    // Register with password
    const authService = new AuthService({ mock: true });
    await authService.register(email, password);

    // OAuth merge
    const oauthService = new OAuthService({ mock: true, sleepFn: noopSleep });
    const origSet = mockStore.oauthSessions.set.bind(mockStore.oauthSessions);
    mockStore.oauthSessions.set = (key, value) => {
      value.auto_authorize_at = Date.now() - 1;
      return origSet(key, value);
    };
    await oauthService.loginWithGitHub();
    mockStore.oauthSessions.set = origSet;

    // Password login should still work
    const loginResult = await authService.login(email, password);
    expect(loginResult.email).toBe(email);
    expect(loginResult.management_key).toBeTruthy();
  });
});
