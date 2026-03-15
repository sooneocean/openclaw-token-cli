import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ConfigManager } from '../../../src/config/manager.js';
import { setActiveProfile, DEFAULT_PROFILE } from '../../../src/config/paths.js';

describe('Profile Management', () => {
  let tempDir: string;
  const origEnv = process.env.OPENCLAW_TOKEN_CONFIG_DIR;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oc-profile-test-'));
    process.env.OPENCLAW_TOKEN_CONFIG_DIR = tempDir;
    setActiveProfile(DEFAULT_PROFILE);
  });

  afterEach(async () => {
    process.env.OPENCLAW_TOKEN_CONFIG_DIR = origEnv;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('validateProfileName', () => {
    it('accepts valid names', () => {
      expect(ConfigManager.validateProfileName('default')).toBe(true);
      expect(ConfigManager.validateProfileName('my-profile')).toBe(true);
      expect(ConfigManager.validateProfileName('work_dev')).toBe(true);
      expect(ConfigManager.validateProfileName('A1')).toBe(true);
    });

    it('rejects invalid names', () => {
      expect(ConfigManager.validateProfileName('')).toBe(false);
      expect(ConfigManager.validateProfileName('-start')).toBe(false);
      expect(ConfigManager.validateProfileName('has space')).toBe(false);
      expect(ConfigManager.validateProfileName('a'.repeat(64))).toBe(false);
      expect(ConfigManager.validateProfileName('special!@#')).toBe(false);
    });
  });

  describe('createProfile', () => {
    it('creates a new profile directory', async () => {
      await ConfigManager.createProfile('work');
      const profileDir = path.join(tempDir, 'profiles', 'work');
      const stat = await fs.stat(profileDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('throws on duplicate profile', async () => {
      await ConfigManager.createProfile('work');
      await expect(ConfigManager.createProfile('work')).rejects.toThrow('already exists');
    });

    it('throws on invalid name', async () => {
      await expect(ConfigManager.createProfile('')).rejects.toThrow('Invalid profile name');
    });
  });

  describe('switchProfile', () => {
    it('switches active profile', async () => {
      await ConfigManager.createProfile('staging');
      await ConfigManager.switchProfile('staging');
      const current = await fs.readFile(path.join(tempDir, 'current_profile'), 'utf-8');
      expect(current.trim()).toBe('staging');
    });

    it('throws on non-existent profile', async () => {
      await expect(ConfigManager.switchProfile('nope')).rejects.toThrow('does not exist');
    });
  });

  describe('listProfiles', () => {
    it('returns empty array when no profiles', async () => {
      const profiles = await ConfigManager.listProfiles();
      expect(profiles).toEqual([]);
    });

    it('lists created profiles', async () => {
      await ConfigManager.createProfile('a-profile');
      await ConfigManager.createProfile('b-profile');
      const profiles = await ConfigManager.listProfiles();
      expect(profiles).toHaveLength(2);
      expect(profiles[0].name).toBe('a-profile');
      expect(profiles[1].name).toBe('b-profile');
    });
  });

  describe('deleteProfile', () => {
    it('deletes a profile', async () => {
      await ConfigManager.createProfile('temp');
      await ConfigManager.deleteProfile('temp');
      const profiles = await ConfigManager.listProfiles();
      expect(profiles).toHaveLength(0);
    });

    it('throws when deleting active profile', async () => {
      await ConfigManager.createProfile('default');
      await ConfigManager.switchProfile('default');
      await expect(ConfigManager.deleteProfile('default')).rejects.toThrow('Cannot delete the active profile');
    });

    it('throws on non-existent profile', async () => {
      await expect(ConfigManager.deleteProfile('nope')).rejects.toThrow('does not exist');
    });
  });
});
