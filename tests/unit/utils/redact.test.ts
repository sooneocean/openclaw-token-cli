import { describe, it, expect } from 'vitest';
import { redactSecret } from '../../../src/utils/redact.js';

describe('redactSecret', () => {
  it('長度 > 16：保留前 12 字元 + **** + 末 4 字元', () => {
    const secret = 'sk-mgmt-a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const result = redactSecret(secret);
    expect(result).toBe('sk-mgmt-a1b2****7890');
    expect(result.startsWith('sk-mgmt-a1b2')).toBe(true);
    expect(result.endsWith('7890')).toBe(true);
    expect(result).toContain('****');
  });

  it('長度 5-16：保留前 4 字元 + ****', () => {
    const secret = 'short-secret'; // 12 chars
    expect(redactSecret(secret)).toBe('shor****');
  });

  it('長度 = 16：保留前 4 字元 + ****', () => {
    const secret = '1234567890123456'; // exactly 16 chars
    expect(redactSecret(secret)).toBe('1234****');
  });

  it('長度 <= 4：全遮蔽為 ****', () => {
    expect(redactSecret('')).toBe('****');
    expect(redactSecret('ab')).toBe('****');
    expect(redactSecret('abcd')).toBe('****');
  });

  it('長度 = 5（短 key 邊界）：保留前 4 + ****', () => {
    expect(redactSecret('12345')).toBe('1234****');
  });

  it('長度 = 17（剛過門檻）：保留前 12 + **** + 末 4', () => {
    const secret = '12345678901234567'; // 17 chars
    const result = redactSecret(secret);
    expect(result).toBe('123456789012****4567');
  });
});
