import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '../src');
const commandsDir = path.join(srcDir, 'commands');
const registryFile = path.join(commandsDir, 'registry.ts');

console.log('Generating command registry...');

if (!fs.existsSync(commandsDir)) {
  console.error('Commands directory not found:', commandsDir);
  process.exit(1);
}

const items = fs.readdirSync(commandsDir);
const commands: string[] = [];

for (const item of items) {
  const itemPath = path.join(commandsDir, item);
  const stats = fs.statSync(itemPath);

  if (stats.isDirectory()) {
    const commandFileTs = path.join(itemPath, 'command.ts');

    if (fs.existsSync(commandFileTs)) {
        commands.push(item);
    }
  }
}

const imports = commands.map(cmd => `import { command as ${cmd} } from './${cmd}/command.js';`).join('\n');
const list = commands.join(',\n  ');

const content = `// This file is auto-generated. Do not edit manually.
import { type CommandDefinition } from '../framework/CommandDefinition.js';
${imports}

export const commands: CommandDefinition[] = [
  ${list}
];
`;

fs.writeFileSync(registryFile, content);
console.log(`Registry generated at ${registryFile}`);
