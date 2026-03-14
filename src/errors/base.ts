export class CLIError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1,
    public readonly suggestion?: string,
  ) {
    super(message);
    this.name = 'CLIError';
  }
}
