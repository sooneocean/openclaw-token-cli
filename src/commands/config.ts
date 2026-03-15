import { Command } from 'commander';
import { ConfigManager } from '../config/manager.js';
import { getGlobalOptions } from '../index.js';
import { output, success, error } from '../output/formatter.js';
import { createTable } from '../output/table.js';

const ALLOWED_KEYS = ['api_base', 'management_key', 'email'] as const;
type ConfigKey = (typeof ALLOWED_KEYS)[number];

export function createConfigCommand(): Command {
  const config = new Command('config').description('Manage CLI configuration');

  config
    .command('get')
    .description('Get a configuration value')
    .argument('<key>', `Config key (${ALLOWED_KEYS.join(', ')})`)
    .action(async (key: string) => {
      const opts = getGlobalOptions();
      const resolved = await ConfigManager.resolve();

      if (!ALLOWED_KEYS.includes(key as ConfigKey)) {
        error(`Unknown config key "${key}". Valid keys: ${ALLOWED_KEYS.join(', ')}`);
        process.exit(1);
      }

      const value = resolved[key as keyof typeof resolved];
      if (opts.json) {
        output({ key, value }, { json: true });
      } else {
        output(value !== null ? String(value) : '(not set)');
      }
    });

  config
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', `Config key (${ALLOWED_KEYS.join(', ')})`)
    .argument('<value>', 'Value to set')
    .action(async (key: string, value: string) => {
      const opts = getGlobalOptions();

      if (!ALLOWED_KEYS.includes(key as ConfigKey)) {
        error(`Unknown config key "${key}". Valid keys: ${ALLOWED_KEYS.join(', ')}`);
        process.exit(1);
      }

      const existing = await ConfigManager.read();
      if (!existing) {
        error('Not logged in. Run: openclaw-token auth login');
        process.exit(1);
      }

      const updated = { ...existing, [key]: value };
      await ConfigManager.write(updated);

      if (opts.json) {
        output({ key, value, updated: true }, { json: true });
      } else {
        success(`Config "${key}" set to "${value}".`);
      }
    });

  config
    .command('list')
    .description('List all configuration values')
    .action(async () => {
      const opts = getGlobalOptions();
      const resolved = await ConfigManager.resolve();

      if (opts.json) {
        output(resolved, { json: true });
      } else {
        const table = createTable(
          ['Key', 'Value'],
          ALLOWED_KEYS.map((k) => [
            k,
            resolved[k as keyof typeof resolved] !== null
              ? String(resolved[k as keyof typeof resolved])
              : '(not set)',
          ]),
        );
        output(table);
      }
    });

  return config;
}
