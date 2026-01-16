import { ProxyHandler } from '../../services/proxy/handler.js';
import type { StartProxyInput, ProxyResult } from '../../services/proxy/spec.js';

export class ProxyCommandHandler {
  constructor(private proxyService: ProxyHandler = new ProxyHandler()) { }

  async execute(input: StartProxyInput): Promise<ProxyResult> {
    return this.proxyService.start(input);
  }
}
