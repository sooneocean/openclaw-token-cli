/**
 * Smoke tests: CLI binary (via tsx)
 *
 * Strategy: invoke the CLI entry point through tsx so we test the real
 * command-parsing pipeline without needing a compiled dist/.
 *
 * All network calls use --mock flag so no real API is hit.
 */
import { describe, it, expect } from 'vitest';
import { execaCommand } from 'execa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');
const CLI = path.join(ROOT, 'bin/openclaw-token.ts');

/** Run the CLI via tsx and return { stdout, stderr, exitCode }. Never throws. */
async function cli(
  args: string,
  env: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execaCommand(`npx tsx ${CLI} ${args}`, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      reject: false,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (err: any) {
    return {
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      exitCode: err.exitCode ?? 1,
    };
  }
}

describe('CLI smoke tests', () => {
  it('--version outputs a version string', async () => {
    const { stdout, exitCode } = await cli('--version');
    expect(exitCode).toBe(0);
    // Should match semver-like pattern e.g. "0.1.0"
    expect(stdout).toMatch(/\d+\.\d+\.\d+/);
  }, 30_000);

  it('--help shows available commands', async () => {
    const { stdout, exitCode } = await cli('--help');
    expect(exitCode).toBe(0);
    // Commander prints Usage: and lists sub-commands
    expect(stdout.toLowerCase()).toMatch(/usage/);
    // Expect main command groups to be listed
    expect(stdout).toMatch(/auth/);
  }, 30_000);

  it('--mock auth whoami --json returns valid JSON when OPENCLAW_TOKEN_KEY is set', async () => {
    // Any valid-format sk-mgmt- UUID token works in MockStore (maps to demo@openclaw.dev)
    const DEMO_TOKEN = 'sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    const { stdout, exitCode } = await cli('--mock auth whoami --json', {
      OPENCLAW_TOKEN_KEY: DEMO_TOKEN,
    });

    expect(exitCode).toBe(0);
    // stdout must be valid JSON
    let parsed: any;
    expect(() => {
      parsed = JSON.parse(stdout);
    }).not.toThrow();

    expect(parsed).toHaveProperty('email', 'demo@openclaw.dev');
    expect(parsed).toHaveProperty('plan');
    expect(parsed).toHaveProperty('credits_remaining');
  }, 30_000);
});
