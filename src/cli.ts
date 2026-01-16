import { Command } from 'commander';
import { InitHandler } from './commands/init/handler.js';
import { DoctorHandler } from './commands/doctor/handler.js';
import { theme, icons } from './ui/theme.js';

const program = new Command();

program
  .name('stitch-mcp')
  .description('Stitch MCP OAuth setup assistant')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize authentication and MCP configuration')
  .option('--local', 'Install gcloud locally to project directory instead of user home', false)
  .option('-y, --defaults', 'Use default values for prompts', false)
  .option('-c, --client <client>', 'MCP client to configure')
  .option('-t, --transport <transport>', 'Transport type (http or stdio)')
  .action(async (options) => {
    try {
      const handler = new InitHandler();
      const result = await handler.execute({
        local: options.local,
        defaults: options.defaults,
        client: options.client,
        transport: options.transport,
      });

      if (!result.success) {
        console.error(theme.red(`\n${icons.error} Setup failed: ${result.error.message}`));
        if (result.error.suggestion) {
          console.error(theme.gray(`  ${result.error.suggestion}`));
        }
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Verify configuration health')
  .option('--verbose', 'Show detailed error information', false)
  .action(async (options) => {
    try {
      const handler = new DoctorHandler();
      const result = await handler.execute({
        verbose: options.verbose,
      });

      if (!result.success) {
        console.error(theme.red(`\n${icons.error} Health check failed: ${result.error.message}`));
        process.exit(1);
      }

      // Exit with error code if any checks failed
      if (!result.data.allPassed) {
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  });

program
  .command('proxy')
  .description('Start the Stitch MCP proxy server')
  .option('--transport <type>', 'Transport type (stdio or sse)', 'stdio')
  .option('--port <number>', 'Port number (required for sse)', (val) => parseInt(val, 10))
  .option('--debug', 'Enable debug logging to file', false)
  .action(async (options) => {
    try {
      // Lazy import to avoid loading server dependencies for simple commands
      const { ProxyCommandHandler } = await import('./commands/proxy/handler.js');
      const handler = new ProxyCommandHandler();

      const result = await handler.execute({
        transport: options.transport as 'stdio' | 'sse',
        port: options.port,
        debug: options.debug,
      });

      if (!result.success) {
        console.error(theme.red(`\n${icons.error} Proxy server error: ${result.error.message}`));
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  });

program.parse();
