import { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import { KeysService } from '../services/keys.service.js';
import { requireAuth } from '../utils/auth-guard.js';
import { getGlobalOptions } from '../index.js';
import { output, success, warn } from '../output/formatter.js';
import { createTable } from '../output/table.js';
import { withSpinner } from '../output/spinner.js';

export function createKeysCommand(): Command {
  const keys = new Command('keys').description('Manage provisioned API keys');

  keys
    .command('create')
    .description('Create a new provisioned API key')
    .requiredOption('--name <name>', 'Key name')
    .option('--limit <number>', 'Credit limit in USD', parseFloat)
    .option('--limit-reset <frequency>', 'Limit reset: daily, weekly, monthly')
    .option('--expires <date>', 'Expiry date (ISO 8601)')
    .action(async (cmdOpts) => {
      const opts = getGlobalOptions();
      const token = await requireAuth();
      const service = new KeysService({ mock: opts.mock, verbose: opts.verbose });

      const result = await withSpinner('Creating key...', () =>
        service.create(token, {
          name: cmdOpts.name,
          credit_limit: cmdOpts.limit ?? null,
          limit_reset: cmdOpts.limitReset ?? null,
          expires_at: cmdOpts.expires ?? null,
        }),
      );

      if (opts.json) {
        output(result, { json: true });
      } else {
        warn('This key will only be shown ONCE. Save it now!');
        const table = createTable(
          ['Field', 'Value'],
          [
            ['Key', result.key || '(hidden)'],
            ['Hash', result.hash],
            ['Name', result.name],
            ['Credit Limit', result.credit_limit !== null ? `$${result.credit_limit.toFixed(2)}` : 'Unlimited'],
            ['Limit Reset', result.limit_reset || 'None'],
            ['Created', result.created_at],
          ],
        );
        output(table);
      }
    });

  keys
    .command('list')
    .description('List all provisioned keys')
    .action(async () => {
      const opts = getGlobalOptions();
      const token = await requireAuth();
      const service = new KeysService({ mock: opts.mock, verbose: opts.verbose });
      const result = await withSpinner('Fetching keys...', () => service.list(token));

      if (opts.json) {
        output(result, { json: true });
      } else if (result.items.length === 0) {
        output('No keys found. Create one with: openclaw-token keys create --name <name>');
      } else {
        const table = createTable(
          ['Hash', 'Name', 'Limit', 'Reset', 'Usage', 'Disabled', 'Created'],
          result.items.map((k) => [
            k.hash,
            k.name,
            k.credit_limit !== null ? `$${k.credit_limit.toFixed(2)}` : '∞',
            k.limit_reset || '-',
            `$${k.usage.toFixed(2)}`,
            k.disabled ? 'Yes' : 'No',
            k.created_at,
          ]),
        );
        output(table);
      }
    });

  keys
    .command('info')
    .description('Show key details and usage')
    .argument('<hash>', 'Key hash')
    .action(async (hash) => {
      const opts = getGlobalOptions();
      const token = await requireAuth();
      const service = new KeysService({ mock: opts.mock, verbose: opts.verbose });
      const result = await withSpinner('Fetching key info...', () => service.info(token, hash));

      if (opts.json) {
        output(result, { json: true });
      } else {
        const infoTable = createTable(
          ['Field', 'Value'],
          [
            ['Hash', result.hash],
            ['Name', result.name],
            ['Credit Limit', result.credit_limit !== null ? `$${result.credit_limit.toFixed(2)}` : 'Unlimited'],
            ['Limit Reset', result.limit_reset || 'None'],
            ['Total Usage', `$${result.usage.toFixed(2)}`],
            ['Daily Usage', `$${result.usage_daily.toFixed(2)}`],
            ['Weekly Usage', `$${result.usage_weekly.toFixed(2)}`],
            ['Monthly Usage', `$${result.usage_monthly.toFixed(2)}`],
            ['Requests', String(result.requests_count)],
            ['Disabled', result.disabled ? 'Yes' : 'No'],
          ],
        );
        output(infoTable);

        if (result.model_usage.length > 0) {
          output('\nModel Usage:');
          const modelTable = createTable(
            ['Model', 'Requests', 'Tokens', 'Cost'],
            result.model_usage.map((m) => [m.model, m.requests, m.tokens, `$${m.cost.toFixed(2)}`]),
          );
          output(modelTable);
        }
      }
    });

  keys
    .command('update')
    .description('Update key settings')
    .argument('<hash>', 'Key hash')
    .option('--limit <number>', 'New credit limit', parseFloat)
    .option('--limit-reset <frequency>', 'New limit reset: daily, weekly, monthly')
    .option('--disabled', 'Disable key')
    .option('--enabled', 'Enable key')
    .action(async (hash, cmdOpts) => {
      const opts = getGlobalOptions();
      const token = await requireAuth();
      const service = new KeysService({ mock: opts.mock, verbose: opts.verbose });

      const params: { credit_limit?: number | null; limit_reset?: 'daily' | 'weekly' | 'monthly' | null; disabled?: boolean } = {};
      if (cmdOpts.limit !== undefined) params.credit_limit = cmdOpts.limit;
      if (cmdOpts.limitReset) params.limit_reset = cmdOpts.limitReset as 'daily' | 'weekly' | 'monthly';
      if (cmdOpts.disabled) params.disabled = true;
      if (cmdOpts.enabled) params.disabled = false;

      const result = await withSpinner('Updating key...', () => service.update(token, hash, params));

      if (opts.json) {
        output(result, { json: true });
      } else {
        success(`Key ${hash} updated.`);
      }
    });

  keys
    .command('rotate')
    .description('Rotate a provisioned key (old key value immediately invalidated)')
    .argument('<hash>', 'Key hash')
    .option('--yes', 'Skip confirmation', false)
    .action(async (hash, cmdOpts) => {
      const opts = getGlobalOptions();
      const token = await requireAuth();

      if (!cmdOpts.yes) {
        const confirmed = await confirm({ message: `Rotate key ${hash}? The old key value will be immediately invalidated.` });
        if (!confirmed) {
          output('Cancelled.');
          return;
        }
      }

      const service = new KeysService({ mock: opts.mock, verbose: opts.verbose });
      const result = await withSpinner('Rotating key...', () => service.rotate(token, hash));

      if (result.disabled) {
        warn('Note: This key is currently disabled.');
      }

      if (opts.json) {
        output(result, { json: true });
      } else {
        warn('This key will only be shown ONCE. Save it now!');
        const table = createTable(
          ['Field', 'Value'],
          [
            ['Key', result.key],
            ['Hash', result.hash],
            ['Name', result.name],
            ['Credit Limit', result.credit_limit !== null ? `$${result.credit_limit.toFixed(2)}` : 'Unlimited'],
            ['Limit Reset', result.limit_reset || 'None'],
            ['Rotated At', result.rotated_at],
          ],
        );
        output(table);
        success(`Key ${hash} rotated successfully.`);
      }
    });

  keys
    .command('revoke')
    .description('Revoke a key')
    .argument('<hash>', 'Key hash')
    .option('--yes', 'Skip confirmation', false)
    .action(async (hash, cmdOpts) => {
      const opts = getGlobalOptions();
      const token = await requireAuth();

      if (!cmdOpts.yes) {
        const confirmed = await confirm({ message: `Revoke key ${hash}? This cannot be undone.` });
        if (!confirmed) {
          output('Cancelled.');
          return;
        }
      }

      const service = new KeysService({ mock: opts.mock, verbose: opts.verbose });
      const result = await withSpinner('Revoking key...', () => service.revoke(token, hash));

      if (opts.json) {
        output(result, { json: true });
      } else {
        success(`Key ${hash} revoked.`);
      }
    });

  return keys;
}
