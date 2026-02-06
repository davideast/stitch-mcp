import { type Command } from 'commander';

export interface CommandDefinition {
  name: string;
  description: string;
  options?: Array<{ flags: string; description: string; defaultValue?: any; fn?: (val: string) => any }>;
  requiredOptions?: Array<{ flags: string; description: string; defaultValue?: any }>;
  arguments?: string; // e.g. '[toolName]'
  action: (args: any, options: any, command: Command) => Promise<void>;
}
