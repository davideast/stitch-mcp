import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { ProxyCommandHandler } from './handler.js';
import { ProxyHandler } from '../../services/proxy/handler.js';
import type { StartProxyInput } from '../../services/proxy/spec.js';

const mockProxyService = {
  start: mock(),
};

mock.module('../../services/proxy/handler.js', () => {
  return {
    ProxyHandler: class {
      start = mockProxyService.start;
    },
  };
});

describe('ProxyCommandHandler', () => {
  beforeEach(() => {
    (mockProxyService.start as any).mockClear();
  });

  it('should call the proxy service with the correct arguments for sse transport', async () => {
    const commandHandler = new ProxyCommandHandler();
    const input: StartProxyInput = {
      transport: 'sse',
      port: 8080,
      debug: true,
    };

    mockProxyService.start.mockResolvedValue({ success: true, data: { status: 'stopped' } });

    await commandHandler.execute(input);

    expect(mockProxyService.start).toHaveBeenCalledWith(input);
  });

  it('should call the proxy service with the correct arguments for stdio transport', async () => {
    const commandHandler = new ProxyCommandHandler();
    const input: StartProxyInput = {
      transport: 'stdio',
      debug: false,
    };

    mockProxyService.start.mockResolvedValue({ success: true, data: { status: 'stopped' } });

    await commandHandler.execute(input);

    expect(mockProxyService.start).toHaveBeenCalledWith(input);
  });

  it('should handle undefined values for optional arguments', async () => {
    const commandHandler = new ProxyCommandHandler();
    const input: StartProxyInput = {
      transport: 'stdio',
    };

    mockProxyService.start.mockResolvedValue({ success: true, data: { status: 'stopped' } });

    await commandHandler.execute(input);

    expect(mockProxyService.start).toHaveBeenCalledWith(input);
  });
});
