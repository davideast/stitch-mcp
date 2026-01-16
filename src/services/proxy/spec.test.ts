import { expect, test } from 'bun:test';
import { ProxyHandler } from './handler.js';
import { type ProxyService } from './spec.js';

test('ProxyHandler should implement ProxyService', () => {
  const handler: ProxyService = new ProxyHandler();
  expect(handler).toBeInstanceOf(ProxyHandler);
});
