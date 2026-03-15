import { Command } from 'commander';
import { ConfigManager } from '../config/manager.js';
import { getActiveProfile } from '../config/paths.js';
import { getGlobalOptions } from '../index.js';
import { output, success, error } from '../output/formatter.js';
import { createTable } from '../output/table.js';

export function createProfileCommand(): Command {
  const profile = new Command('profile').description('Manage CLI profiles (multiple accounts/servers)');

  profile
    .command('create')
    .description('Create a new profile')
    .argument('<name>', 'Profile name (alphanumeric, hyphens, underscores)')
    .action(async (name: string) => {
      const opts = getGlobalOptions();
      try {
        await ConfigManager.createProfile(name);
        if (opts.json) {
          output({ name, created: true }, { json: true });
        } else {
          success(`Profile "${name}" created. Use \`openclaw-token profile switch ${name}\` to activate.`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (opts.json) {
          output({ error: { message: msg } }, { json: true });
        } else {
          error(msg);
        }
        process.exit(1);
      }
    });

  profile
    .command('switch')
    .description('Switch to a profile')
    .argument('<name>', 'Profile name')
    .action(async (name: string) => {
      const opts = getGlobalOptions();
      try {
        await ConfigManager.switchProfile(name);
        if (opts.json) {
          output({ name, active: true }, { json: true });
        } else {
          success(`Switched to profile "${name}".`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (opts.json) {
          output({ error: { message: msg } }, { json: true });
        } else {
          error(msg);
        }
        process.exit(1);
      }
    });

  profile
    .command('list')
    .description('List all profiles')
    .action(async () => {
      const opts = getGlobalOptions();
      const profiles = await ConfigManager.listProfiles();

      if (profiles.length === 0) {
        if (opts.json) {
          output({ items: [], total: 0 }, { json: true });
        } else {
          output('No profiles found. Create one with: openclaw-token profile create <name>');
        }
        return;
      }

      if (opts.json) {
        output({ items: profiles, total: profiles.length }, { json: true });
      } else {
        const table = createTable(
          ['Name', 'Active', 'Logged In'],
          profiles.map((p) => [
            p.name,
            p.active ? '*' : '',
            p.hasConfig ? 'Yes' : 'No',
          ]),
        );
        output(table);
      }
    });

  profile
    .command('current')
    .description('Show the active profile')
    .action(async () => {
      const opts = getGlobalOptions();
      const name = getActiveProfile();
      if (opts.json) {
        output({ name }, { json: true });
      } else {
        output(`Active profile: ${name}`);
      }
    });

  profile
    .command('delete')
    .description('Delete a profile')
    .argument('<name>', 'Profile name')
    .action(async (name: string) => {
      const opts = getGlobalOptions();
      try {
        await ConfigManager.deleteProfile(name);
        if (opts.json) {
          output({ name, deleted: true }, { json: true });
        } else {
          success(`Profile "${name}" deleted.`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (opts.json) {
          output({ error: { message: msg } }, { json: true });
        } else {
          error(msg);
        }
        process.exit(1);
      }
    });

  return profile;
}
