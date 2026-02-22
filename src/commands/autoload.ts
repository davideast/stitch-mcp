import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CommandDefinition } from '../framework/CommandDefinition.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function loadCommands(): Promise<CommandDefinition[]> {
  const commands: CommandDefinition[] = [];

  try {
    let commandsDir = __dirname;

    // Check if we are in the root (dist) or in the commands dir (src/commands)
    // In dist (bundled), __dirname is .../dist. It contains 'commands' folder.
    // In src (dev), __dirname is .../src/commands. It does not contain 'commands' folder.
    try {
        const rootEntries = await readdir(__dirname, { withFileTypes: true });
        if (rootEntries.some(e => e.isDirectory() && e.name === 'commands')) {
            commandsDir = join(__dirname, 'commands');
        }
    } catch (e) {
        // ignore
    }

    const entries = await readdir(commandsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const commandPath = join(commandsDir, entry.name);
        let files: string[] = [];
        try {
            files = await readdir(commandPath);
        } catch (e) {
            continue;
        }

        // Look for command.js or command.ts
        const commandFile = files.find(f => f === 'command.js' || f === 'command.ts');

        if (commandFile) {
          try {
            const modulePath = join(commandPath, commandFile);
            const moduleUrl = pathToFileURL(modulePath).href;

            // Use dynamic import
            const mod = await import(moduleUrl);
            if (mod.command) {
              commands.push(mod.command);
            }
          } catch (error) {
            console.error(`Failed to load command from ${entry.name}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to read commands directory:', error);
  }

  return commands;
}
