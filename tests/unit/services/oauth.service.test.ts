/**
 * Unit tests: OAuthService (mock mode)
 *
 * Strategy: use mock mode so all HTTP calls go through MockStore.
 * Isolate filesystem side-effects with a per-test temp directory.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OAuthService } from '../../../src/services/oauth.service.js';
import { ConfigManager } from '../../../src/config/manager.js';
import { mockStore } from '../../../src/mock/store.js';
import { CLIError } from '../../../src/errors/base.js';

// Ensure mock handlers are registered before first request
import '../../../src/mock/index.js';

describe('OAuthService (mock mode)', () => {
  let tmpDir: string;
  const noopSleep = () => Promise.resolve();

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-oauth-svc-test-'));
    process.env.OPENCLAW_TOKEN_CONFIG_DIR = tmpDir;
    mockStore.reset();
  });

  afterEach(async () => {
    delete process.env.OPENCLAW_TOKEN_CONFIG_DIR;
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // 1. requestDeviceCode success
  it('requestDeviceCode returns device_code and user_code', async () => {
    const service = new OAuthService({ mock: true, sleepFn: noopSleep });
    const result = await service.requestDeviceCode();
    expect(result.device_code).toMatch(/^dc_/);
    expect(result.user_code).toMatch(/^[A-Z]{4}-[A-Z]{4}$/);
    expect(result.verification_uri).toBe('https://github.com/login/device');
    expect(result.interval).toBe(5);
    expect(result.expires_in).toBe(900);
  });

  // 2. pollForToken — authorization_pending then access_token
  it('pollForToken returns token after authorization', async () => {
    const service = new OAuthService({ mock: true, sleepFn: noopSleep });
    const codeResult = await service.requestDeviceCode();

    // Set auto_authorize_at to past so next poll returns token immediately
    const session = mockStore.oauthSessions.get(codeResult.device_code)!;
    session.auto_authorize_at = Date.now() - 1;

    const token = await service.pollForToken(
      codeResult.device_code,
      codeResult.interval,
      codeResult.expires_in,
    );
    expect(token).toMatch(/^gho_/);
  });

  // 3. pollForToken — slow_down increases interval (we verify it doesn't crash and eventually gets token)
  it('pollForToken handles slow_down by continuing', async () => {
    const service = new OAuthService({ mock: true, sleepFn: noopSleep });
    const codeResult = await service.requestDeviceCode();

    // Will be pending first, then auto-authorize triggers after a very short delay
    const session = mockStore.oauthSessions.get(codeResult.device_code)!;
    session.auto_authorize_at = Date.now() + 50; // Very short delay — noopSleep makes polling instant

    const token = await service.pollForToken(
      codeResult.device_code,
      1, // 1 second interval (noopSleep makes it instant)
      codeResult.expires_in,
    );
    expect(token).toMatch(/^gho_/);
  });

  // 4. pollForToken — expired_token throws
  it('pollForToken throws on expired device code', async () => {
    const service = new OAuthService({ mock: true, sleepFn: noopSleep });
    const codeResult = await service.requestDeviceCode();

    // Force session to be expired; don't auto-authorize so we hit the expires_at check
    const session = mockStore.oauthSessions.get(codeResult.device_code)!;
    session.auto_authorize_at = Date.now() + 999999; // Don't auto-authorize
    session.expires_at = Date.now() - 1;             // Already expired

    await expect(
      service.pollForToken(codeResult.device_code, 1, codeResult.expires_in),
    ).rejects.toThrow('Authorization timed out');
  });

  // 5. pollForToken — throws when deadline exceeded before authorization
  it('pollForToken throws when deadline exceeded', async () => {
    const service = new OAuthService({ mock: true, sleepFn: noopSleep });
    const codeResult = await service.requestDeviceCode();

    // Never authorize
    const session = mockStore.oauthSessions.get(codeResult.device_code)!;
    session.auto_authorize_at = Date.now() + 999999;

    await expect(
      service.pollForToken(codeResult.device_code, 1, 0), // 0 second expiry = immediate timeout
    ).rejects.toThrow('Authorization timed out');
  });

  // 6. pollForToken — nonexistent device code throws CLIError (bad_device_code)
  it('pollForToken throws on nonexistent device code', async () => {
    const service = new OAuthService({ mock: true, sleepFn: noopSleep });

    // The mock handler returns bad_device_code for unknown codes, which is re-thrown
    // via the default branch in the switch (not caught as network error)
    await expect(
      service.pollForToken('dc_nonexistent', 1, 10),
    ).rejects.toThrow();
  });

  // 7. fetchUserInfo success
  it('fetchUserInfo returns user info with valid token', async () => {
    const service = new OAuthService({ mock: true, sleepFn: noopSleep });

    // Setup: complete device flow to get a valid access_token
    const codeResult = await service.requestDeviceCode();
    const session = mockStore.oauthSessions.get(codeResult.device_code)!;
    session.auto_authorize_at = Date.now() - 1;

    const token = await service.pollForToken(codeResult.device_code, 1, 900);

    const userInfo = await service.fetchUserInfo(token);
    expect(userInfo.email).toBe('github-user@example.com');
    expect(userInfo.management_key).toMatch(/^sk-mgmt-/);
    expect(typeof userInfo.merged).toBe('boolean');
  });

  // 8. fetchUserInfo — empty email throws
  it('fetchUserInfo throws when email is empty', async () => {
    const service = new OAuthService({ mock: true, sleepFn: noopSleep });

    const codeResult = await service.requestDeviceCode();
    const session = mockStore.oauthSessions.get(codeResult.device_code)!;
    session.auto_authorize_at = Date.now() - 1;
    session.email = '';

    const token = await service.pollForToken(codeResult.device_code, 1, 900);

    await expect(service.fetchUserInfo(token)).rejects.toThrow();
  });
});
