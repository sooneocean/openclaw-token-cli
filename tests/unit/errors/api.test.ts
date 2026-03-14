import { describe, it, expect } from 'vitest';
import { mapApiError, mapNetworkError } from '../../../src/errors/api.js';
import { CLIError } from '../../../src/errors/base.js';

describe('mapApiError', () => {
  it('maps 401 to session expired', () => {
    const err = mapApiError(401);
    expect(err).toBeInstanceOf(CLIError);
    expect(err.message).toContain('Session expired');
  });

  it('maps 402 to insufficient credits', () => {
    const err = mapApiError(402, 'INSUFFICIENT_CREDITS');
    expect(err.message).toContain('Insufficient credits');
  });

  it('maps 402 PAYMENT_FAILED', () => {
    const err = mapApiError(402, 'PAYMENT_FAILED');
    expect(err.message).toContain('Payment failed');
  });

  it('maps 409 to conflict with detail', () => {
    const err = mapApiError(409, 'CONFLICT', 'Name already exists');
    expect(err.message).toContain('conflict');
    expect(err.message).toContain('Name already exists');
  });

  it('maps 410 to key already revoked', () => {
    const err = mapApiError(410);
    expect(err.message).toContain('revoked');
  });
});

describe('mapNetworkError', () => {
  it('maps to network error', () => {
    const err = mapNetworkError(new Error('ECONNREFUSED'));
    expect(err).toBeInstanceOf(CLIError);
    expect(err.message).toContain('Cannot reach API');
  });
});
