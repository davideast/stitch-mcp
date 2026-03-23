import { describe, test, it, expect } from 'bun:test';
import { InitHandler } from './handler';
import { InitCommand, InitInputSchema } from './spec';

describe('InitCommand', () => {
  test('should be implemented by InitHandler', () => {
    const handler: InitCommand = new InitHandler();
    expect(handler).toBeInstanceOf(InitHandler);
  });
});

describe('InitInputSchema', () => {
  it('defaults json to false', () => {
    const result = InitInputSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.json).toBe(false);
    }
  });

  it('accepts json: true', () => {
    const result = InitInputSchema.safeParse({ json: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.json).toBe(true);
    }
  });
});
