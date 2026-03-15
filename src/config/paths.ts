import os from 'node:os';
import path from 'node:path';

export const DEFAULT_API_BASE = 'https://proxy.openclaw-token.dev/v1';
export const DEFAULT_PROFILE = 'default';

let activeProfile: string | null = null;

export function setActiveProfile(name: string): void {
  activeProfile = name;
}

export function getActiveProfile(): string {
  return activeProfile || DEFAULT_PROFILE;
}

export function getConfigDir(): string {
  if (process.env.OPENCLAW_TOKEN_CONFIG_DIR) {
    return process.env.OPENCLAW_TOKEN_CONFIG_DIR;
  }
  return path.join(os.homedir(), '.openclaw-token');
}

export function getProfilesDir(): string {
  return path.join(getConfigDir(), 'profiles');
}

export function getProfileDir(profileName?: string): string {
  const name = profileName || getActiveProfile();
  return path.join(getProfilesDir(), name);
}

export function getCurrentProfileFile(): string {
  return path.join(getConfigDir(), 'current_profile');
}

export function getConfigFile(): string {
  return path.join(getProfileDir(), 'config.json');
}

// Alias kept for internal backward-compat (manager.ts uses this name)
export function getConfigPath(): string {
  return getConfigFile();
}

export function getAuditLogPath(): string {
  return path.join(getConfigDir(), 'audit.log');
}
