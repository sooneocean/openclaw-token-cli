import chalk from 'chalk';

export interface OutputOptions {
  json?: boolean;
  noColor?: boolean;
}

function isColorEnabled(options: OutputOptions = {}): boolean {
  return !options.noColor && !process.env.NO_COLOR;
}

function formatObject(obj: Record<string, unknown>, colored: boolean): string {
  return Object.entries(obj)
    .map(([key, value]) => {
      const k = colored ? chalk.cyan(key) : key;
      const v = String(value);
      return `  ${k}: ${v}`;
    })
    .join('\n');
}

export function output(data: unknown, options: OutputOptions = {}): void {
  if (options.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else if (typeof data === 'string') {
    process.stdout.write(data + '\n');
  } else {
    const colored = isColorEnabled(options);
    process.stdout.write(formatObject(data as Record<string, unknown>, colored) + '\n');
  }
}

export function success(message: string): void {
  const line = process.env.NO_COLOR
    ? `✓ ${message}`
    : `${chalk.green('✓')} ${message}`;
  process.stdout.write(line + '\n');
}

export function error(message: string, suggestion?: string): void {
  const prefix = process.env.NO_COLOR ? '✗' : chalk.red('✗');
  process.stderr.write(`${prefix} ${message}\n`);
  if (suggestion) {
    const hint = process.env.NO_COLOR ? suggestion : chalk.dim(suggestion);
    process.stderr.write(`  ${hint}\n`);
  }
}

export function warn(message: string): void {
  const prefix = process.env.NO_COLOR ? '⚠' : chalk.yellow('⚠');
  process.stdout.write(`${prefix} ${message}\n`);
}

export function info(message: string): void {
  const prefix = process.env.NO_COLOR ? 'ℹ' : chalk.blue('ℹ');
  process.stdout.write(`${prefix} ${message}\n`);
}

export function verbose(message: string): void {
  process.stderr.write(`[verbose] ${message}\n`);
}
