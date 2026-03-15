import { describe, it, expect } from 'vitest';
import { createProgram } from '../../src/index.js';

describe('New Commands Registration', () => {
  it('profile command is registered', () => {
    const prog = createProgram();
    const profileCmd = prog.commands.find((c) => c.name() === 'profile');
    expect(profileCmd).toBeDefined();
  });

  it('profile has subcommands', () => {
    const prog = createProgram();
    const profileCmd = prog.commands.find((c) => c.name() === 'profile');
    const subcommands = profileCmd?.commands.map((c) => c.name());
    expect(subcommands).toContain('create');
    expect(subcommands).toContain('switch');
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('current');
    expect(subcommands).toContain('delete');
  });

  it('audit command is registered', () => {
    const prog = createProgram();
    const auditCmd = prog.commands.find((c) => c.name() === 'audit');
    expect(auditCmd).toBeDefined();
  });

  it('audit has subcommands', () => {
    const prog = createProgram();
    const auditCmd = prog.commands.find((c) => c.name() === 'audit');
    const subcommands = auditCmd?.commands.map((c) => c.name());
    expect(subcommands).toContain('show');
    expect(subcommands).toContain('clear');
  });

  it('completion command is registered', () => {
    const prog = createProgram();
    const completionCmd = prog.commands.find((c) => c.name() === 'completion');
    expect(completionCmd).toBeDefined();
  });

  it('completion has bash and zsh subcommands', () => {
    const prog = createProgram();
    const completionCmd = prog.commands.find((c) => c.name() === 'completion');
    const subcommands = completionCmd?.commands.map((c) => c.name());
    expect(subcommands).toContain('bash');
    expect(subcommands).toContain('zsh');
  });

  it('--profile global option is registered', () => {
    const prog = createProgram();
    const profileOpt = prog.options.find((o) => o.long === '--profile');
    expect(profileOpt).toBeDefined();
  });

  it('version is 0.7.0', () => {
    const prog = createProgram();
    expect(prog.version()).toBe('0.7.0');
  });
});
