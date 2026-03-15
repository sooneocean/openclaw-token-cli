import { describe, it, expect } from 'vitest';
import { createProgram } from '../../src/index.js';

describe('Keys Export/Import/Usage Commands', () => {
  it('keys export command exists', () => {
    const prog = createProgram();
    const keysCmd = prog.commands.find((c) => c.name() === 'keys');
    const exportCmd = keysCmd?.commands.find((c) => c.name() === 'export');
    expect(exportCmd).toBeDefined();

    const formatOpt = exportCmd?.options.find((o) => o.long === '--format');
    expect(formatOpt).toBeDefined();

    const outputOpt = exportCmd?.options.find((o) => o.long === '--output');
    expect(outputOpt).toBeDefined();
  });

  it('keys import command exists', () => {
    const prog = createProgram();
    const keysCmd = prog.commands.find((c) => c.name() === 'keys');
    const importCmd = keysCmd?.commands.find((c) => c.name() === 'import');
    expect(importCmd).toBeDefined();
  });

  it('keys usage command exists with --watch flag', () => {
    const prog = createProgram();
    const keysCmd = prog.commands.find((c) => c.name() === 'keys');
    const usageCmd = keysCmd?.commands.find((c) => c.name() === 'usage');
    expect(usageCmd).toBeDefined();

    const watchOpt = usageCmd?.options.find((o) => o.long === '--watch');
    expect(watchOpt).toBeDefined();

    const intervalOpt = usageCmd?.options.find((o) => o.long === '--interval');
    expect(intervalOpt).toBeDefined();
  });

  it('version is 0.6.0', () => {
    const prog = createProgram();
    expect(prog.version()).toBe('0.6.0');
  });
});
