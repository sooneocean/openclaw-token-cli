import { describe, it, expect, beforeEach } from 'vitest';
import { MockStore, DEMO_MANAGEMENT_KEY, DEMO_EMAIL } from '../../../src/mock/store.js';

describe('MockStore', () => {
  let store: MockStore;

  beforeEach(() => {
    store = new MockStore();
  });

  it('initializes with demo account', () => {
    expect(store.users.has('demo@openclaw.dev')).toBe(true);
    expect(store.credits.get('demo@openclaw.dev')).toEqual({ total_credits: 100, total_usage: 0 });
  });

  it('accepts valid token format', () => {
    expect(store.isValidToken('sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
    // demo key uses 'demo' which is not hex — so the regex won't match it
    // but any valid UUID format is accepted
    expect(store.isValidToken('sk-mgmt-00000000-0000-0000-0000-000000000000')).toBe(true);
  });

  it('rejects invalid token format', () => {
    expect(store.isValidToken('invalid')).toBe(false);
    expect(store.isValidToken('sk-prov-abc')).toBe(false);
    expect(store.isValidToken('')).toBe(false);
  });

  it('maps DEMO_MANAGEMENT_KEY to demo email', () => {
    expect(store.getEmailForToken(DEMO_MANAGEMENT_KEY)).toBe(DEMO_EMAIL);
  });

  it('returns null for unmapped token', () => {
    expect(store.getEmailForToken('sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBeNull();
  });

  it('setTokenEmailMapping creates mapping', () => {
    const token = 'sk-mgmt-11111111-1111-1111-1111-111111111111';
    store.setTokenEmailMapping(token, 'test@example.com');
    expect(store.getEmailForToken(token)).toBe('test@example.com');
  });

  it('removeTokenEmailMapping removes mapping', () => {
    const token = 'sk-mgmt-22222222-2222-2222-2222-222222222222';
    store.setTokenEmailMapping(token, 'test@example.com');
    store.removeTokenEmailMapping(token);
    expect(store.getEmailForToken(token)).toBeNull();
  });

  it('reset rebuilds demo mapping only', () => {
    const token = 'sk-mgmt-33333333-3333-3333-3333-333333333333';
    store.setTokenEmailMapping(token, 'custom@example.com');
    store.reset();
    expect(store.getEmailForToken(token)).toBeNull();
    expect(store.getEmailForToken(DEMO_MANAGEMENT_KEY)).toBe(DEMO_EMAIL);
  });

  it('reset clears and reinitializes', () => {
    store.users.set('test@test.com', { email: 'test@test.com', password: 'x', management_key: 'x', plan: 'free', created_at: '' });
    store.reset();
    expect(store.users.has('test@test.com')).toBe(false);
    expect(store.users.has('demo@openclaw.dev')).toBe(true);
  });

  it('generates management key with correct prefix', () => {
    const key = store.generateManagementKey();
    expect(key).toMatch(/^sk-mgmt-/);
  });

  it('generates provisioned key with correct prefix', () => {
    const key = store.generateProvisionedKey();
    expect(key).toMatch(/^sk-prov-/);
  });

  it('generates key hash with correct prefix', () => {
    const hash = store.generateKeyHash();
    expect(hash).toMatch(/^hash_/);
  });

  it('supports constructor injection', () => {
    const custom = new MockStore({
      users: new Map([['custom@test.com', { email: 'custom@test.com', password: 'x', management_key: 'x', plan: 'pro', created_at: '' }]]),
    });
    expect(custom.users.has('custom@test.com')).toBe(true);
    expect(custom.users.has('demo@openclaw.dev')).toBe(false);
  });
});
