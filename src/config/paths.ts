import os from 'node:os';
import path from 'node:path';

export const DEFAULT_API_BASE = 'https://proxy.openclaw-token.dev/v1';

export function getConfigDir(): string {
  if (process.env.OPENCLAW_TOKEN_CONFIG_DIR) {
    return process.env.OPENCLAW_TOKEN_CONFIG_DIR;
  }
  return path.join(os.homedir(), '.openclaw-token');
}

export function getConfigFile(): string {
  return path.join(getConfigDir(), 'config.json');
}

// Alias kept for internal backward-compat (manager.ts uses this name)
export function getConfigPath(): string {
  return getConfigFile();
}
