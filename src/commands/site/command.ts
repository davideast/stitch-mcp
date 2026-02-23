import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme, icons } from '../../ui/theme.js';
import { SiteOptionsSchema, type SiteOptions } from './spec.js';

export const command: CommandDefinition<any, SiteOptions> = {
  name: 'site',
  description: 'Build a structured site from Stitch screens',
  requiredOptions: [
    { flags: '-p, --project <id>', description: 'Project ID' }
  ],
  options: [
    { flags: '-o, --output <dir>', description: 'Output directory', defaultValue: '.' },
    { flags: '-e, --export', description: 'Export screen-to-route config as build_site JSON', defaultValue: false }
  ],
  action: async (_args, options) => {
    try {
      const parsedOptions = SiteOptionsSchema.parse(options);
      const { SiteCommandHandler } = await import('./index.js');
      const handler = new SiteCommandHandler();
      await handler.execute({
          projectId: parsedOptions.project,
          outputDir: parsedOptions.output,
          export: parsedOptions.export
      });
      process.exit(0);
    } catch (error) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error);
      process.exit(1);
    }
  }
};
