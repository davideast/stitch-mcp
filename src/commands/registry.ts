/// <reference types="vite/client" />
import { type CommandDefinition } from '../framework/CommandDefinition.js';

// Auto-discover commands using import.meta.glob
const modules = import.meta.glob('./*/command.ts', { eager: true }) as Record<string, { command: CommandDefinition }>;

export const commands: CommandDefinition[] = Object.values(modules)
  .map((mod) => mod.command)
  .sort((a, b) => a.name.localeCompare(b.name));
