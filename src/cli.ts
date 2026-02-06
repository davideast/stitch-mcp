import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type CommandDefinition } from './framework/CommandDefinition.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('stitch-mcp')
  .description('Stitch MCP OAuth setup assistant')
  .version('0.1.0');

async function loadCommands() {
  const commandsDir = path.join(__dirname, 'commands');

  if (!fs.existsSync(commandsDir)) {
    return;
  }

  const items = fs.readdirSync(commandsDir);

  for (const item of items) {
    const itemPath = path.join(commandsDir, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      // Check for command.ts (or .js after compilation)
      const commandFile = fs.existsSync(path.join(itemPath, 'command.ts'))
        ? path.join(itemPath, 'command.ts')
        : path.join(itemPath, 'command.js');

      if (fs.existsSync(commandFile)) {
        try {
          // Dynamic import
          const module = await import(commandFile);
          if (module.command) {
            registerCommand(module.command);
          }
        } catch (error) {
          // console.error(`Failed to load command from ${item}:`, error);
        }
      }
    }
  }
}

function registerCommand(def: CommandDefinition) {
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
      // We want to normalize this.
      // The last arg is command, second to last is options.
      // Any preceding args are positional arguments.
      const commandObj = args[args.length - 1];
      const optionsObj = args[args.length - 2];
      const positionalArgs = args.slice(0, args.length - 2);

      // Map positional args to object if needed, but for now passing as array is fine or
      // let the handler handle it.
      // Actually our interface expected (args, options, command)
      // Let's pass the raw args as the first argument (could be string or undefined)
      // If there are multiple arguments, we might need to adjust.
      // For now, most commands have 0 or 1 argument.

      const primaryArg = positionalArgs.length > 0 ? positionalArgs[0] : undefined;
      await def.action(primaryArg, optionsObj, commandObj);
  });
}

await loadCommands();

program.parse();
