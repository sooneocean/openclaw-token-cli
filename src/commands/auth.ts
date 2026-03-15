import { Command } from 'commander';
import { input, password, confirm } from '@inquirer/prompts';
import { AuthService } from '../services/auth.service.js';
import { OAuthService } from '../services/oauth.service.js';
import { requireAuth } from '../utils/auth-guard.js';
import { getGlobalOptions } from '../index.js';
import { output, success } from '../output/formatter.js';
import { createTable } from '../output/table.js';
import { withSpinner } from '../output/spinner.js';

export function createAuthCommand(): Command {
  const auth = new Command('auth').description('Account authentication');

  auth
    .command('register')
    .description('Register a new account')
    .action(async () => {
      const opts = getGlobalOptions();
      const email = await input({ message: 'Email:' });
      const pwd = await password({ message: 'Password:' });
      const confirmPwd = await password({ message: 'Confirm password:' });

      if (pwd !== confirmPwd) {
        throw new Error('Passwords do not match');
      }

      const service = new AuthService({ mock: opts.mock, verbose: opts.verbose });
      const result = await withSpinner('Registering...', () => service.register(email, pwd));

      if (opts.json) {
        output(result, { json: true });
      } else {
        success(`Account registered! Management key saved.`);
      }
    });

  auth
    .command('login')
    .description('Login to existing account')
    .option('--github', 'Login with GitHub (OAuth Device Flow)')
    .action(async (_opts, cmd) => {
      const loginOpts = cmd.opts();
      const opts = getGlobalOptions();

      if (loginOpts.github) {
        // OAuth Device Flow
        const service = new OAuthService({ mock: opts.mock, verbose: opts.verbose });
        const result = await service.loginWithGitHub();

        if (opts.json) {
          output(result, { json: true });
        } else {
          const mergeNote = result.merged ? ' (account merged)' : '';
          success(`Logged in as ${result.email}${mergeNote}`);
        }
      } else {
        // Existing email/password flow
        const email = await input({ message: 'Email:' });
        const pwd = await password({ message: 'Password:' });

        const service = new AuthService({ mock: opts.mock, verbose: opts.verbose });
        const result = await withSpinner('Logging in...', () => service.login(email, pwd));

        if (opts.json) {
          output(result, { json: true });
        } else {
          success(`Logged in as ${result.email}`);
        }
      }
    });

  auth
    .command('logout')
    .description('Logout (clear local config)')
    .action(async () => {
      const opts = getGlobalOptions();
      const service = new AuthService({ mock: opts.mock });
      await service.logout();

      if (opts.json) {
        output({ success: true }, { json: true });
      } else {
        success('Logged out successfully.');
      }
    });

  auth
    .command('whoami')
    .description('Show current account info')
    .action(async () => {
      const opts = getGlobalOptions();
      const token = await requireAuth();
      const service = new AuthService({ mock: opts.mock, verbose: opts.verbose });
      const result = await withSpinner('Fetching account info...', () => service.whoami(token));

      if (opts.json) {
        output(result, { json: true });
      } else {
        const table = createTable(
          ['Field', 'Value'],
          [
            ['Email', result.email],
            ['Plan', result.plan],
            ['Credits Remaining', `$${result.credits_remaining.toFixed(2)}`],
            ['Keys', String(result.keys_count)],
            ['Created', result.created_at],
          ],
        );
        output(table);
      }
    });

  return auth;
}
