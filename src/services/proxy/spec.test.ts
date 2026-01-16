import { test, expect } from 'bun:test';
import type { ProxyService } from './spec';
import { ProxyHandler } from './handler';

test('ProxyHandler should implement ProxyService', () => {
  const handler: ProxyService = new ProxyHandler();
  expect(handler).toBeInstanceOf(ProxyHandler);
});
