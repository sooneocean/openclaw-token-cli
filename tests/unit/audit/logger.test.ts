import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AuditLogger } from '../../../src/audit/logger.js';

describe('AuditLogger', () => {
  let tempDir: string;
  const origEnv = process.env.OPENCLAW_TOKEN_CONFIG_DIR;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oc-audit-test-'));
    process.env.OPENCLAW_TOKEN_CONFIG_DIR = tempDir;
  });

  afterEach(async () => {
    process.env.OPENCLAW_TOKEN_CONFIG_DIR = origEnv;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('logs an entry', async () => {
    await AuditLogger.log({ command: 'auth', args: ['login'], status: 'success' });
    const entries = await AuditLogger.read();
    expect(entries).toHaveLength(1);
    expect(entries[0].command).toBe('auth');
    expect(entries[0].args).toEqual(['login']);
    expect(entries[0].status).toBe('success');
    expect(entries[0].timestamp).toBeDefined();
  });

  it('logs multiple entries', async () => {
    await AuditLogger.log({ command: 'auth', args: ['login'], status: 'success' });
    await AuditLogger.log({ command: 'keys', args: ['create'], status: 'success' });
    await AuditLogger.log({ command: 'keys', args: ['revoke'], status: 'error', detail: 'not found' });
    const entries = await AuditLogger.read();
    expect(entries).toHaveLength(3);
  });

  it('respects limit', async () => {
    for (let i = 0; i < 10; i++) {
      await AuditLogger.log({ command: `cmd-${i}`, args: [], status: 'success' });
    }
    const entries = await AuditLogger.read(3);
    expect(entries).toHaveLength(3);
    expect(entries[0].command).toBe('cmd-7');
  });

  it('clears the log', async () => {
    await AuditLogger.log({ command: 'auth', args: ['login'], status: 'success' });
    await AuditLogger.clear();
    const entries = await AuditLogger.read();
    expect(entries).toHaveLength(0);
  });

  it('returns empty array when no log file', async () => {
    const entries = await AuditLogger.read();
    expect(entries).toEqual([]);
  });
});
