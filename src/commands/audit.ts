import { Command } from 'commander';
import { AuditLogger } from '../audit/logger.js';
import { getGlobalOptions } from '../index.js';
import { output, success } from '../output/formatter.js';
import { createTable } from '../output/table.js';

export function createAuditCommand(): Command {
  const audit = new Command('audit').description('View local operation audit log');

  audit
    .command('show')
    .description('Show recent audit log entries')
    .option('--limit <n>', 'Number of entries to show', '20')
    .action(async (cmdOpts) => {
      const opts = getGlobalOptions();
      const limit = parseInt(cmdOpts.limit, 10) || 20;
      const entries = await AuditLogger.read(limit);

      if (entries.length === 0) {
        if (opts.json) {
          output({ items: [], total: 0 }, { json: true });
        } else {
          output('No audit log entries.');
        }
        return;
      }

      if (opts.json) {
        output({ items: entries, total: entries.length }, { json: true });
      } else {
        const table = createTable(
          ['Time', 'Command', 'Status', 'Detail'],
          entries.map((e) => [
            e.timestamp.replace('T', ' ').slice(0, 19),
            `${e.command} ${e.args.join(' ')}`.trim(),
            e.status,
            e.detail || '',
          ]),
        );
        output(table);
      }
    });

  audit
    .command('clear')
    .description('Clear the audit log')
    .action(async () => {
      const opts = getGlobalOptions();
      await AuditLogger.clear();
      if (opts.json) {
        output({ cleared: true }, { json: true });
      } else {
        success('Audit log cleared.');
      }
    });

  return audit;
}
