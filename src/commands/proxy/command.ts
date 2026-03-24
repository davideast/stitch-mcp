import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme, icons } from '../../ui/theme.js';
import { ProxyOptionsSchema, type ProxyOptions } from './spec.js';

export const command: CommandDefinition<any, ProxyOptions> = {
  name: 'proxy',
  description: 'Start the Stitch MCP proxy server',
  options: [
    { flags: '--transport <type>', description: 'Transport type (stdio)', defaultValue: 'stdio' },
    { flags: '--port <number>', description: 'Port number', fn: (val) => parseInt(val, 10) },
    { flags: '--debug', description: 'Enable debug logging to file', defaultValue: false },
  ],
  action: async (_args, options) => {
    try {
      const parsedOptions = ProxyOptionsSchema.parse(options);
      const { ProxyCommandHandler } = await import('./handler.js');
      const handler = new ProxyCommandHandler();

      const result = await handler.execute({
        port: parsedOptions.port,
        debug: parsedOptions.debug,
      });

      if (!result.success) {
        console.error(theme.red(`\n${icons.error} Proxy server error: ${result.error?.message}`));
        process.exit(1);
      }
      // No process.exit(0) here — the proxy is a long-running server.
      // The stdin listener keeps the event loop alive until the client disconnects.
    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  }
};
