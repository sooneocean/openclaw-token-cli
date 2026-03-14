import { ConfigManager } from '../config/manager.js';
import { CLIError } from '../errors/base.js';
import { NOT_LOGGED_IN } from '../errors/messages.js';

export async function requireAuth(): Promise<string> {
  const resolved = await ConfigManager.resolve();
  if (!resolved.management_key) {
    throw new CLIError(NOT_LOGGED_IN, 1, 'openclaw-token auth login');
  }
  return resolved.management_key;
}
