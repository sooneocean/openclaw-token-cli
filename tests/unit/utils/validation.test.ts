import { describe, it, expect } from 'vitest';
import { emailSchema, passwordSchema, amountSchema, keyNameSchema, creditLimitSchema } from '../../../src/utils/validation.js';

describe('emailSchema', () => {
  it('accepts valid email', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true);
  });
  it('rejects invalid email', () => {
    expect(emailSchema.safeParse('not-email').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts valid password', () => {
    expect(passwordSchema.safeParse('Secure123').success).toBe(true);
  });
  it('rejects short password', () => {
    expect(passwordSchema.safeParse('Ab1').success).toBe(false);
  });
  it('rejects no uppercase', () => {
    expect(passwordSchema.safeParse('lowercase123').success).toBe(false);
  });
  it('rejects no number', () => {
    expect(passwordSchema.safeParse('NoNumberHere').success).toBe(false);
  });
});

describe('amountSchema', () => {
  it('accepts amount >= 5', () => {
    expect(amountSchema.safeParse(5).success).toBe(true);
    expect(amountSchema.safeParse(25).success).toBe(true);
  });
  it('rejects amount < 5', () => {
    expect(amountSchema.safeParse(4.99).success).toBe(false);
  });
});

describe('keyNameSchema', () => {
  it('accepts valid key name', () => {
    expect(keyNameSchema.safeParse('my-agent').success).toBe(true);
    expect(keyNameSchema.safeParse('agent_01').success).toBe(true);
  });
  it('rejects empty name', () => {
    expect(keyNameSchema.safeParse('').success).toBe(false);
  });
  it('rejects special characters', () => {
    expect(keyNameSchema.safeParse('my agent!').success).toBe(false);
  });
  it('rejects name > 100 chars', () => {
    expect(keyNameSchema.safeParse('a'.repeat(101)).success).toBe(false);
  });
});

describe('creditLimitSchema', () => {
  it('accepts >= 0', () => {
    expect(creditLimitSchema.safeParse(0).success).toBe(true);
    expect(creditLimitSchema.safeParse(10).success).toBe(true);
  });
  it('accepts null', () => {
    expect(creditLimitSchema.safeParse(null).success).toBe(true);
  });
  it('rejects negative', () => {
    expect(creditLimitSchema.safeParse(-1).success).toBe(false);
  });
});
