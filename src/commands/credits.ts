import { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import { CreditsService } from '../services/credits.service.js';
import { requireAuth } from '../utils/auth-guard.js';
import { getGlobalOptions } from '../index.js';
import { output, success } from '../output/formatter.js';
import { createTable } from '../output/table.js';
import { withSpinner } from '../output/spinner.js';

export function createCreditsCommand(): Command {
  const credits = new Command('credits').description('Manage credits');

  credits
    .command('balance')
    .description('Check credits balance')
    .action(async () => {
      const opts = getGlobalOptions();
      const token = await requireAuth();
      const service = new CreditsService({ mock: opts.mock, verbose: opts.verbose });
      const result = await withSpinner('Fetching balance...', () => service.balance(token));

      if (opts.json) {
        output(result, { json: true });
      } else {
        const table = createTable(
          ['Metric', 'Amount'],
          [
            ['Total Credits', `$${result.total_credits.toFixed(2)}`],
            ['Total Usage', `$${result.total_usage.toFixed(2)}`],
            ['Remaining', `$${result.remaining.toFixed(2)}`],
          ],
        );
        output(table);
      }
    });

  credits
    .command('buy')
    .description('Purchase credits')
    .requiredOption('--amount <number>', 'Amount in USD', parseFloat)
    .option('--yes', 'Skip confirmation', false)
    .action(async (cmdOpts) => {
      const opts = getGlobalOptions();
      const token = await requireAuth();
      const amount = cmdOpts.amount as number;

      if (amount < 5) {
        throw new Error('Minimum purchase amount is $5.00');
      }

      const platformFee = Math.round(Math.max(amount * 0.055, 0.80) * 100) / 100;
      const total = Math.round((amount + platformFee) * 100) / 100;

      if (!cmdOpts.yes) {
        const table = createTable(
          ['Item', 'Amount'],
          [
            ['Credits', `$${amount.toFixed(2)}`],
            ['Platform Fee (5.5%)', `$${platformFee.toFixed(2)}`],
            ['Total', `$${total.toFixed(2)}`],
          ],
        );
        process.stdout.write(table + '\n');

        const confirmed = await confirm({ message: 'Confirm purchase?' });
        if (!confirmed) {
          output('Purchase cancelled.');
          return;
        }
      }

      const service = new CreditsService({ mock: opts.mock, verbose: opts.verbose });
      const result = await withSpinner('Processing purchase...', () => service.buy(token, amount));

      if (opts.json) {
        output(result, { json: true });
      } else {
        success(`Purchase successful! New balance: $${result.new_balance.toFixed(2)} (txn: ${result.transaction_id})`);
      }
    });

  credits
    .command('history')
    .description('View transaction history')
    .option('--limit <number>', 'Items per page', '20')
    .option('--offset <number>', 'Skip items', '0')
    .option('--type <type>', 'Filter by type: purchase, usage, refund')
    .action(async (cmdOpts) => {
      const opts = getGlobalOptions();
      const token = await requireAuth();
      const service = new CreditsService({ mock: opts.mock, verbose: opts.verbose });
      const result = await withSpinner('Fetching history...', () =>
        service.history(token, {
          limit: parseInt(cmdOpts.limit, 10),
          offset: parseInt(cmdOpts.offset, 10),
          type: cmdOpts.type,
        }),
      );

      if (opts.json) {
        output(result, { json: true });
      } else {
        if (result.items.length === 0) {
          output('No transactions found.');
        } else {
          const table = createTable(
            ['Date', 'Type', 'Amount', 'Balance After', 'Description'],
            result.items.map((t) => [
              t.created_at,
              t.type,
              `$${t.amount.toFixed(2)}`,
              `$${t.balance_after.toFixed(2)}`,
              t.description,
            ]),
          );
          output(table);
          if (result.has_more) {
            output(`Showing ${result.items.length} of ${result.total}. Use --offset to see more.`);
          }
        }
      }
    });

  credits
    .command('auto-topup')
    .description('Configure auto top-up')
    .option('--threshold <number>', 'Trigger threshold in USD', parseFloat)
    .option('--amount <number>', 'Top-up amount in USD', parseFloat)
    .option('--enable', 'Enable auto top-up')
    .option('--disable', 'Disable auto top-up')
    .action(async (cmdOpts) => {
      const opts = getGlobalOptions();
      const token = await requireAuth();
      const service = new CreditsService({ mock: opts.mock, verbose: opts.verbose });

      const hasUpdate = cmdOpts.threshold !== undefined || cmdOpts.amount !== undefined || cmdOpts.enable || cmdOpts.disable;

      if (hasUpdate) {
        const config: { enabled?: boolean; threshold?: number; amount?: number } = {};
        if (cmdOpts.enable) config.enabled = true;
        if (cmdOpts.disable) config.enabled = false;
        if (cmdOpts.threshold) config.threshold = cmdOpts.threshold;
        if (cmdOpts.amount) config.amount = cmdOpts.amount;

        const result = await withSpinner('Updating auto top-up...', () => service.setAutoTopup(token, config));

        if (opts.json) {
          output(result, { json: true });
        } else {
          success(`Auto top-up ${result.enabled ? 'enabled' : 'disabled'}: threshold=$${result.threshold.toFixed(2)}, amount=$${result.amount.toFixed(2)}`);
        }
      } else {
        const result = await withSpinner('Fetching auto top-up settings...', () => service.getAutoTopup(token));

        if (opts.json) {
          output(result, { json: true });
        } else {
          const table = createTable(
            ['Setting', 'Value'],
            [
              ['Enabled', result.enabled ? 'Yes' : 'No'],
              ['Threshold', `$${result.threshold.toFixed(2)}`],
              ['Amount', `$${result.amount.toFixed(2)}`],
            ],
          );
          output(table);
        }
      }
    });

  return credits;
}
