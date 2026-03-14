import { describe, it, expect, vi, beforeEach } from 'vitest';
import { output } from '../../../src/output/formatter.js';

describe('output', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  it('outputs valid JSON in json mode', () => {
    const data = { key: 'value', count: 42 };
    output(data, { json: true });
    const written = (process.stdout.write as any).mock.calls[0][0] as string;
    expect(() => JSON.parse(written)).not.toThrow();
    expect(JSON.parse(written)).toEqual(data);
  });

  it('outputs string as-is', () => {
    output('hello world');
    const written = (process.stdout.write as any).mock.calls[0][0] as string;
    expect(written.trim()).toBe('hello world');
  });

  it('formats object as key-value pairs', () => {
    output({ name: 'test', value: 123 });
    const written = (process.stdout.write as any).mock.calls[0][0] as string;
    expect(written).toContain('name');
    expect(written).toContain('test');
  });
});
