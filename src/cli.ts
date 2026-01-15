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
  .option('--staging', 'Use staging Stitch API endpoint', false)
  .action(async (options) => {
    try {
      const handler = new InitHandler();
      const result = await handler.execute({
        local: options.local,
        staging: options.staging,
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
  .option('--staging', 'Test against staging Stitch API endpoint', false)
  .option('--verbose', 'Show detailed error information', false)
  .action(async (options) => {
    try {
      const handler = new DoctorHandler();
      const result = await handler.execute({
        staging: options.staging,
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

program.parse();
