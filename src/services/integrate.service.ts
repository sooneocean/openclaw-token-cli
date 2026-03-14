import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import which from 'which';
import { atomicWrite } from '../utils/fs.js';
import { DEFAULT_API_BASE } from '../config/paths.js';
import { CLIError } from '../errors/base.js';
import { KeysService } from './keys.service.js';

const OPENCLAW_DIR = () => path.join(os.homedir(), '.openclaw');
const OPENCLAW_CONFIG = () => path.join(OPENCLAW_DIR(), 'openclaw.json');
const PROVIDER_NAME = 'openclaw-token-fallback';
const PROXY_BASE_URL = DEFAULT_API_BASE;

export interface IntegrateServiceOptions {
  mock: boolean;
  verbose?: boolean;
}

export interface IntegrationStatus {
  installed: boolean;
  integrated: boolean;
  provider_name: string;
  proxy_url: string;
  key_hash?: string;
}

export class IntegrateService {
  private options: IntegrateServiceOptions;

  constructor(options: IntegrateServiceOptions) {
    this.options = options;
  }

  async detectOpenClaw(): Promise<boolean> {
    if (this.options.mock) return true;
    try {
      await which('openclaw');
      return true;
    } catch {
      return false;
    }
  }

  async integrate(token: string): Promise<{ key_hash: string; provider_name: string }> {
    const installed = await this.detectOpenClaw();
    if (!installed) {
      throw new CLIError(
        'OpenClaw CLI not found.',
        1,
        'Install OpenClaw: npm install -g openclaw',
      );
    }

    // Get or create a provisioned key
    const keysService = new KeysService(this.options);
    const existing = await keysService.list(token);
    let keyHash: string;

    if (existing.items.length > 0) {
      keyHash = existing.items[0].hash;
    } else {
      const newKey = await keysService.create(token, { name: 'openclaw-fallback' });
      keyHash = newKey.hash;
    }

    // Read/create OpenClaw config
    const configPath = OPENCLAW_CONFIG();
    let config: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(raw);
    } catch {
      // Config doesn't exist, create fresh
    }

    // Inject provider
    const models = (config.models || {}) as Record<string, unknown>;
    const providers = (models.providers || {}) as Record<string, unknown>;
    providers[PROVIDER_NAME] = {
      api: 'openai-completions',
      baseUrl: PROXY_BASE_URL,
      authMode: 'api-key',
    };
    models.providers = providers;
    config.models = models;

    await atomicWrite(configPath, JSON.stringify(config, null, 2));

    return { key_hash: keyHash, provider_name: PROVIDER_NAME };
  }

  async remove(): Promise<void> {
    const configPath = OPENCLAW_CONFIG();
    try {
      const raw = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(raw) as Record<string, unknown>;
      const models = (config.models || {}) as Record<string, unknown>;
      const providers = (models.providers || {}) as Record<string, unknown>;
      delete providers[PROVIDER_NAME];
      models.providers = providers;
      config.models = models;
      await atomicWrite(configPath, JSON.stringify(config, null, 2));
    } catch {
      // Config doesn't exist, nothing to remove
    }
  }

  async status(): Promise<IntegrationStatus> {
    const installed = await this.detectOpenClaw();
    if (!installed) {
      return { installed: false, integrated: false, provider_name: PROVIDER_NAME, proxy_url: PROXY_BASE_URL };
    }

    const configPath = OPENCLAW_CONFIG();
    try {
      const raw = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(raw) as Record<string, unknown>;
      const models = (config.models || {}) as Record<string, unknown>;
      const providers = (models.providers || {}) as Record<string, unknown>;
      const integrated = PROVIDER_NAME in providers;
      return { installed: true, integrated, provider_name: PROVIDER_NAME, proxy_url: PROXY_BASE_URL };
    } catch {
      return { installed: true, integrated: false, provider_name: PROVIDER_NAME, proxy_url: PROXY_BASE_URL };
    }
  }
}
