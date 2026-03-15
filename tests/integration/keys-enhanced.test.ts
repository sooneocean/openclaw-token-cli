import { describe, it, expect, beforeAll } from 'vitest';
import { createProgram, type CreateProgramOptions } from '../../src/index.js';

function createMockProgram(opts: CreateProgramOptions = {}) {
  return createProgram({ mock: true, json: true, ...opts });
}

describe('Keys Enhanced Features', () => {
  // These tests verify the --sort and --filter flags parse correctly
  // and the revoke-all command exists

  it('keys list accepts --sort flag', async () => {
    const prog = createMockProgram();
    const listCmd = prog.commands
      .find((c) => c.name() === 'keys')
      ?.commands.find((c) => c.name() === 'list');
    expect(listCmd).toBeDefined();

    const sortOpt = listCmd?.options.find((o) => o.long === '--sort');
    expect(sortOpt).toBeDefined();
  });

  it('keys list accepts --filter flag', async () => {
    const prog = createMockProgram();
    const listCmd = prog.commands
      .find((c) => c.name() === 'keys')
      ?.commands.find((c) => c.name() === 'list');
    expect(listCmd).toBeDefined();

    const filterOpt = listCmd?.options.find((o) => o.long === '--filter');
    expect(filterOpt).toBeDefined();
  });

  it('keys revoke-all command exists', async () => {
    const prog = createMockProgram();
    const revokeAllCmd = prog.commands
      .find((c) => c.name() === 'keys')
      ?.commands.find((c) => c.name() === 'revoke-all');
    expect(revokeAllCmd).toBeDefined();
  });
});
