/**
 * Unit tests: AuthService (mock mode)
 *
 * Strategy: use mock mode so all HTTP calls go through MockStore.
 * Stub ConfigManager to isolate filesystem side-effects.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AuthService } from '../../../src/services/auth.service.js';
import { ConfigManager } from '../../../src/config/manager.js';
import { mockStore } from '../../../src/mock/store.js';

// Ensure mock handlers are registered before first request
import '../../../src/mock/index.js';

describe('AuthService (mock mode)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-auth-svc-test-'));
    process.env.OPENCLAW_TOKEN_CONFIG_DIR = tmpDir;
    delete process.env.OPENCLAW_TOKEN_KEY;
    mockStore.reset();
  });

  afterEach(async () => {
    delete process.env.OPENCLAW_TOKEN_CONFIG_DIR;
    delete process.env.OPENCLAW_TOKEN_KEY;
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('saves config after successful registration', async () => {
      const service = new AuthService({ mock: true });
      const email = 'newuser@example.com';
      const password = 'Register1!';

      const result = await service.register(email, password);

      expect(result.email).toBe(email);
      expect(result.management_key).toMatch(/^sk-mgmt-/);

      const config = await ConfigManager.read();
      expect(config).not.toBeNull();
      expect(config!.email).toBe(email);
      expect(config!.management_key).toBe(result.management_key);
      expect(config!.api_base).toMatch(/^https?:\/\//);
    });

    it('throws on duplicate email (409)', async () => {
      const service = new AuthService({ mock: true });
      // demo@openclaw.dev already exists in the default MockStore state
      await expect(service.register('demo@openclaw.dev', 'Password1!')).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('updates config after successful login', async () => {
      const service = new AuthService({ mock: true });

      const result = await service.login('demo@openclaw.dev', 'Demo1234!');

      expect(result.email).toBe('demo@openclaw.dev');
      expect(result.management_key).toMatch(/^sk-mgmt-/);

      const config = await ConfigManager.read();
      expect(config).not.toBeNull();
      expect(config!.email).toBe('demo@openclaw.dev');
      expect(config!.management_key).toBe(result.management_key);
    });

    it('throws on wrong password (401 → session expired message)', async () => {
      const service = new AuthService({ mock: true });
      await expect(service.login('demo@openclaw.dev', 'WrongPassword1!')).rejects.toThrow(
        'Session expired',
      );
    });
  });

  describe('logout', () => {
    it('deletes config file', async () => {
      const service = new AuthService({ mock: true });

      // Write a config first so there is something to delete
      await service.login('demo@openclaw.dev', 'Demo1234!');
      expect(await ConfigManager.exists()).toBe(true);

      await service.logout();

      expect(await ConfigManager.exists()).toBe(false);
    });

    it('does not throw when no config exists', async () => {
      const service = new AuthService({ mock: true });
      // No prior login — config does not exist
      await expect(service.logout()).resolves.not.toThrow();
    });
  });

  describe('rotate', () => {
    it('returns new key and updates config', async () => {
      const service = new AuthService({ mock: true });

      // First login to have a config
      await service.login('demo@openclaw.dev', 'Demo1234!');
      const configBefore = await ConfigManager.read();
      const oldKey = configBefore!.management_key;

      const result = await service.rotate(oldKey);

      expect(result.management_key).toMatch(/^sk-mgmt-/);
      expect(result.management_key).not.toBe(oldKey);
      expect(result.email).toBe('demo@openclaw.dev');
      expect(result.rotated_at).toBeTruthy();

      const configAfter = await ConfigManager.read();
      expect(configAfter!.management_key).toBe(result.management_key);
      expect(configAfter!.email).toBe('demo@openclaw.dev');
    });

    it('throws on invalid token', async () => {
      const service = new AuthService({ mock: true });
      await expect(service.rotate('invalid-token')).rejects.toThrow();
    });
  });

  describe('whoami', () => {
    it('returns account info for valid token', async () => {
      const service = new AuthService({ mock: true });
      const token = 'sk-mgmt-de000000-0000-0000-0000-000000000000';

      const result = await service.whoami(token);

      expect(result.email).toBe('demo@openclaw.dev');
      expect(result.plan).toBe('free');
      expect(typeof result.credits_remaining).toBe('number');
      expect(typeof result.keys_count).toBe('number');
    });

    it('throws session-expired error for invalid token', async () => {
      const service = new AuthService({ mock: true });

      await expect(service.whoami('invalid-token')).rejects.toThrow('Session expired');
    });
  });
});
