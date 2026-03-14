import ora from 'ora';

export async function withSpinner<T>(text: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.NO_COLOR || process.argv.includes('--no-color')) {
    process.stderr.write(`${text}...\n`);
    return fn();
  }
  const spinner = ora(text).start();
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (err) {
    spinner.fail();
    throw err;
  }
}
