import { describe, it, expect } from 'vitest';
import { createProgram } from '../../src/index.js';

describe('Config Command', () => {
  it('config command is registered', () => {
    const prog = createProgram();
    const configCmd = prog.commands.find((c) => c.name() === 'config');
    expect(configCmd).toBeDefined();
  });

  it('config has get/set/list subcommands', () => {
    const prog = createProgram();
    const configCmd = prog.commands.find((c) => c.name() === 'config');
    const subs = configCmd?.commands.map((c) => c.name());
    expect(subs).toContain('get');
    expect(subs).toContain('set');
    expect(subs).toContain('list');
  });
});
