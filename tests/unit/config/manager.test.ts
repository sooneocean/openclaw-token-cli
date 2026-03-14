import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ConfigManager } from '../../../src/config/manager.js';

describe('ConfigManager', () => {
  let tmpDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-token-test-'));
    process.env.OPENCLAW_TOKEN_CONFIG_DIR = tmpDir;
    delete process.env.OPENCLAW_TOKEN_KEY;
    delete process.env.OPENCLAW_TOKEN_API_BASE;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('read returns null when no config exists', async () => {
    const result = await ConfigManager.read();
    expect(result).toBeNull();
  });

  it('write and read roundtrip', async () => {
    const config = {
      management_key: 'sk-mgmt-test0000-0000-0000-0000-000000000000',
      api_base: 'https://proxy.openclaw-token.dev/v1',
      email: 'test@test.com',
      created_at: '2026-01-01T00:00:00Z',
      last_login: '2026-01-01T00:00:00Z',
    };
    await ConfigManager.write(config);
    const result = await ConfigManager.read();
    expect(result).toEqual(config);
  });

  it('delete removes config', async () => {
    await ConfigManager.write({
      management_key: 'sk-mgmt-test0000-0000-0000-0000-000000000000',
      api_base: 'https://proxy.openclaw-token.dev/v1',
      email: 'test@test.com',
      created_at: '2026-01-01T00:00:00Z',
      last_login: '2026-01-01T00:00:00Z',
    });
    await ConfigManager.delete();
    const result = await ConfigManager.read();
    expect(result).toBeNull();
  });

  it('resolve uses env var for management_key', async () => {
    process.env.OPENCLAW_TOKEN_KEY = 'sk-mgmt-env00000-0000-0000-0000-000000000000';
    const resolved = await ConfigManager.resolve();
    expect(resolved.management_key).toBe('sk-mgmt-env00000-0000-0000-0000-000000000000');
  });

  it('resolve works without config when env var set', async () => {
    process.env.OPENCLAW_TOKEN_KEY = 'sk-mgmt-env00000-0000-0000-0000-000000000000';
    const resolved = await ConfigManager.resolve();
    expect(resolved.management_key).toBe('sk-mgmt-env00000-0000-0000-0000-000000000000');
    expect(resolved.api_base).toBe('https://proxy.openclaw-token.dev/v1');
    expect(resolved.email).toBeNull();
  });

  it('resolve returns null management_key when no config and no env', async () => {
    const resolved = await ConfigManager.resolve();
    expect(resolved.management_key).toBeNull();
  });

  it('read returns null for invalid JSON', async () => {
    const configPath = path.join(tmpDir, 'config.json');
    await fs.writeFile(configPath, 'not-json', 'utf-8');
    const result = await ConfigManager.read();
    expect(result).toBeNull();
  });
});
