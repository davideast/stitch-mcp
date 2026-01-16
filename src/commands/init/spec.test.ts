import { describe, test, expect } from 'bun:test';
import { InitHandler } from './handler';
import { InitCommand } from './spec';

describe('InitCommand', () => {
  test('should be implemented by InitHandler', () => {
    const handler: InitCommand = new InitHandler();
    expect(handler).toBeInstanceOf(InitHandler);
  });
});
