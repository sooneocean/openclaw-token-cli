import { Command } from 'commander';
import { CLIError } from './errors/base.js';
import { error, output } from './output/formatter.js';
import { createAuthCommand } from './commands/auth.js';
import { createCreditsCommand } from './commands/credits.js';
import { createKeysCommand } from './commands/keys.js';
import { createIntegrateCommand } from './commands/integrate.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GlobalOptions {
  json: boolean;
  mock: boolean;
  color: boolean;
  verbose: boolean;
}

export interface CreateProgramOptions {
  /** Override global flag defaults (useful for tests) */
  json?: boolean;
  mock?: boolean;
  verbose?: boolean;
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a fully-configured Commander program instance.
 *
 * Using a factory allows tests to inject options and share a MockStore
 * without polluting the module-level singleton.
 */
export function createProgram(opts: CreateProgramOptions = {}): Command {
  const prog = new Command();

  prog
    .name('openclaw-token')
    .description(
      'CLI client for OpenClaw Token proxy — manage credits, provision API keys, integrate with OpenClaw fallback chain',
    )
    .version('0.1.0')
    .option('--json', 'Output in JSON format', opts.json ?? false)
    .option('--mock', 'Use mock backend (no real API calls)', opts.mock ?? false)
    .option('--no-color', 'Disable colored output')
    .option('--verbose', 'Show debug information (API calls)', opts.verbose ?? false);

  // ── Command registration ────────────────────────────────────────────────
  prog.addCommand(createAuthCommand());
  prog.addCommand(createCreditsCommand());
  prog.addCommand(createKeysCommand());
  prog.addCommand(createIntegrateCommand());

  return prog;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getGlobalOptions(prog?: Command): GlobalOptions {
  const o = (prog ?? program).opts();
  return {
    json: o['json'] ?? false,
    mock: o['mock'] ?? process.env['OPENCLAW_TOKEN_MOCK'] === '1',
    color: o['color'] !== false && !process.env['NO_COLOR'],
    verbose: o['verbose'] ?? false,
  };
}

export function handleError(err: unknown, prog?: Command): never {
  const isJson = prog?.opts()?.['json'] ?? false;

  if (err instanceof CLIError) {
    if (isJson) {
      output({ error: { message: err.message } }, { json: true });
    } else {
      error(err.message, err.suggestion);
    }
    process.exit(err.exitCode);
  }

  const message = err instanceof Error ? err.message : String(err);
  if (isJson) {
    output({ error: { message } }, { json: true });
  } else {
    error(message);
  }
  process.exit(1);
}

// ── Module-level singleton (used by bin/openclaw-token.ts) ───────────────────

const program = createProgram();

export function run(argv: string[]): void {
  program.parseAsync(argv).catch((err: unknown) => handleError(err, program));
}

export { program };
