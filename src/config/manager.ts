import fs from 'node:fs/promises';
import { getConfigPath, getConfigDir, DEFAULT_API_BASE } from './paths.js';
import { configSchema, type OpenClawTokenConfig } from './schema.js';
import { atomicWrite } from '../utils/fs.js';

export interface ResolvedConfig {
  management_key: string | null;
  api_base: string;
  email: string | null;
}

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
}
