import { Command } from 'commander';
import { IntegrateService } from '../services/integrate.service.js';
import { requireAuth } from '../utils/auth-guard.js';
import { getGlobalOptions } from '../index.js';
import { output, success } from '../output/formatter.js';
import { createTable } from '../output/table.js';
import { withSpinner } from '../output/spinner.js';

export function createIntegrateCommand(): Command {
  const integrate = new Command('integrate')
    .description('Integrate with OpenClaw fallback chain')
    .option('--remove', 'Remove integration')
    .option('--status', 'Show integration status')
    .action(async (cmdOpts) => {
      const opts = getGlobalOptions();
      const service = new IntegrateService({ mock: opts.mock, verbose: opts.verbose });

      if (cmdOpts.status) {
        const status = await withSpinner('Checking integration status...', () => service.status());

        if (opts.json) {
          output(status, { json: true });
        } else {
          const table = createTable(
            ['Field', 'Value'],
            [
              ['OpenClaw Installed', status.installed ? 'Yes' : 'No'],
              ['Integrated', status.integrated ? 'Yes' : 'No'],
              ['Provider', status.provider_name],
              ['Proxy URL', status.proxy_url],
            ],
          );
          output(table);
        }
        return;
      }

      if (cmdOpts.remove) {
        await withSpinner('Removing integration...', () => service.remove());

        if (opts.json) {
          output({ success: true, removed: true }, { json: true });
        } else {
          success('Integration removed from OpenClaw config.');
        }
        return;
      }

      // Default: integrate
      const token = await requireAuth();
      const result = await withSpinner('Integrating with OpenClaw...', () => service.integrate(token));

      if (opts.json) {
        output(result, { json: true });
      } else {
        success(`Integrated! Provider "${result.provider_name}" injected into OpenClaw fallback chain.`);
        output(`Key hash: ${result.key_hash}`);
      }
    });

  return integrate;
}
