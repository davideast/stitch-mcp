import { Command } from 'commander';
import { commands } from './commands/registry.js';
import { theme } from './ui/theme.js';

const program = new Command();

program
  .name('stitch-mcp')
  .description('Stitch MCP OAuth setup assistant')
  .version('0.1.0');

function registerCommands() {
  for (const def of commands) {
    const cmd = program.command(def.name);
    if (def.arguments) {
      cmd.arguments(def.arguments);
    }
    cmd.description(def.description);

    if (def.options) {
      for (const opt of def.options) {
        if (opt.fn) {
            cmd.option(opt.flags, opt.description, opt.fn, opt.defaultValue);
        } else {
            cmd.option(opt.flags, opt.description, opt.defaultValue);
        }
      }
    }

    if (def.requiredOptions) {
      for (const opt of def.requiredOptions) {
        cmd.requiredOption(opt.flags, opt.description, opt.defaultValue);
      }
    }

    cmd.action(async (...args: any[]) => {
        // Commander passes args..., options, command
        // The last arg is command, second to last is options.
        // Any preceding args are positional arguments.

        const commandObj = args[args.length - 1];
        const optionsObj = args[args.length - 2];
        const positionalArgs = args.slice(0, args.length - 2);

        const primaryArg = positionalArgs.length > 0 ? positionalArgs[0] : undefined;
        await def.action(primaryArg, optionsObj, commandObj);
    });
  }
}

registerCommands();

program.parse();
