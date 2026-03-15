import fs from 'node:fs/promises';
import path from 'node:path';
import {
  getConfigPath,
  getConfigDir,
  getProfilesDir,
  getProfileDir,
  getCurrentProfileFile,
  DEFAULT_API_BASE,
  DEFAULT_PROFILE,
  setActiveProfile,
  getActiveProfile,
} from './paths.js';
import { configSchema, type OpenClawTokenConfig } from './schema.js';
import { atomicWrite } from '../utils/fs.js';

export interface ResolvedConfig {
  management_key: string | null;
  api_base: string;
  email: string | null;
}

const PROFILE_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/;

export class ConfigManager {
  static async read(): Promise<OpenClawTokenConfig | null> {
    try {
      const raw = await fs.readFile(getConfigPath(), 'utf-8');
      const parsed = JSON.parse(raw);
      return configSchema.parse(parsed);
    } catch {
      return null;
    }
  }

  static async write(config: OpenClawTokenConfig): Promise<void> {
    const dir = path.dirname(getConfigPath());
    await fs.mkdir(dir, { recursive: true });
    await atomicWrite(getConfigPath(), JSON.stringify(config, null, 2));
  }

  static async delete(): Promise<void> {
    try {
      await fs.unlink(getConfigPath());
    } catch {
      // Ignore if file doesn't exist
    }
  }

  static async exists(): Promise<boolean> {
    try {
      await fs.access(getConfigPath());
      return true;
    } catch {
      return false;
    }
  }

  static async resolve(): Promise<ResolvedConfig> {
    const config = await ConfigManager.read();

    const management_key =
      process.env.OPENCLAW_TOKEN_KEY ||
      config?.management_key ||
      null;

    const api_base =
      process.env.OPENCLAW_TOKEN_API_BASE ||
      config?.api_base ||
      DEFAULT_API_BASE;

    const email = config?.email || null;

    return { management_key, api_base, email };
  }

  // ── Profile Management ──────────────────────────────────────────────

  static validateProfileName(name: string): boolean {
    return PROFILE_NAME_RE.test(name);
  }

  static async initActiveProfile(): Promise<void> {
    try {
      const current = await fs.readFile(getCurrentProfileFile(), 'utf-8');
      const name = current.trim();
      if (name) setActiveProfile(name);
    } catch {
      // No current_profile file — use default
    }

    // Migrate legacy config: if ~/.openclaw-token/config.json exists
    // but profiles dir doesn't, move it to profiles/default/
    const legacyPath = path.join(getConfigDir(), 'config.json');
    const defaultProfileDir = getProfileDir(DEFAULT_PROFILE);
    try {
      await fs.access(legacyPath);
      try {
        await fs.access(defaultProfileDir);
      } catch {
        // Legacy config exists, profile dir doesn't — migrate
        await fs.mkdir(defaultProfileDir, { recursive: true });
        await fs.rename(legacyPath, path.join(defaultProfileDir, 'config.json'));
      }
    } catch {
      // No legacy config — nothing to migrate
    }
  }

  static async createProfile(name: string): Promise<void> {
    if (!ConfigManager.validateProfileName(name)) {
      throw new Error(`Invalid profile name "${name}". Use alphanumeric, hyphens, underscores (1-63 chars).`);
    }
    const dir = getProfileDir(name);
    try {
      await fs.access(dir);
      throw new Error(`Profile "${name}" already exists.`);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('already exists')) throw e;
    }
    await fs.mkdir(dir, { recursive: true });
  }

  static async switchProfile(name: string): Promise<void> {
    const dir = getProfileDir(name);
    try {
      await fs.access(dir);
    } catch {
      throw new Error(`Profile "${name}" does not exist.`);
    }
    await fs.mkdir(getConfigDir(), { recursive: true });
    await atomicWrite(getCurrentProfileFile(), name);
    setActiveProfile(name);
  }

  static async listProfiles(): Promise<{ name: string; active: boolean; hasConfig: boolean }[]> {
    const profilesDir = getProfilesDir();
    try {
      await fs.access(profilesDir);
    } catch {
      return [];
    }
    const entries = await fs.readdir(profilesDir, { withFileTypes: true });
    const current = getActiveProfile();
    const profiles: { name: string; active: boolean; hasConfig: boolean }[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const configExists = await ConfigManager.profileHasConfig(entry.name);
      profiles.push({
        name: entry.name,
        active: entry.name === current,
        hasConfig: configExists,
      });
    }
    return profiles.sort((a, b) => a.name.localeCompare(b.name));
  }

  static async deleteProfile(name: string): Promise<void> {
    if (name === getActiveProfile()) {
      throw new Error(`Cannot delete the active profile "${name}". Switch to another profile first.`);
    }
    const dir = getProfileDir(name);
    try {
      await fs.access(dir);
    } catch {
      throw new Error(`Profile "${name}" does not exist.`);
    }
    await fs.rm(dir, { recursive: true });
  }

  static async profileHasConfig(name: string): Promise<boolean> {
    try {
      await fs.access(path.join(getProfileDir(name), 'config.json'));
      return true;
    } catch {
      return false;
    }
  }
}
