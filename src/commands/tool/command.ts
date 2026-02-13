import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme, icons } from '../../ui/theme.js';

export const command: CommandDefinition = {
  name: 'tool',
  arguments: '[toolName]',
  description: 'Invoke MCP tools directly',
  options: [
    { flags: '-s, --schema', description: 'Show tool arguments and schema' },
    { flags: '-d, --data <json>', description: 'JSON data (like curl -d)' },
    { flags: '-f, --data-file <path>', description: 'Read JSON from file (like curl -d @file)' },
    { flags: '-o, --output <format>', description: 'Output format: json, pretty, raw', defaultValue: 'pretty' },
  ],
  action: async (toolName, options) => {
    try {
      const { ToolCommandHandler } = await import('./handler.js');
      const handler = new ToolCommandHandler();
      const result = await handler.execute({
        toolName,
        showSchema: options.schema,
        data: options.data,
        dataFile: options.dataFile,
        output: options.output,
      });

      if (!result.success) {
        const errorOutput = {
          success: false,
          error: result.error,
          ...(result.data && { data: result.data }),
        };
        console.error(JSON.stringify(errorOutput, null, 2));
        process.exit(1);
      }

      if (options.output === 'json') {
        console.log(JSON.stringify(result.data));
      } else if (options.output === 'raw') {
        console.log(result.data);
      } else {
        console.log(JSON.stringify(result.data, null, 2));
      }
      process.exit(0);
    } catch (error: any) {
      // Detect MCP SDK errors and print a clean message
      if (error?.code !== undefined && error?.message) {
        console.error(`Error: ${error.message}`);
      } else if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('Unexpected error:', error);
      }
      process.exit(1);
    }
  }
};
