import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme, icons } from '../../ui/theme.js';
import { UploadInputSchema, type UploadInput } from './spec.js';

export const command: CommandDefinition<any, any> = {
  name: 'upload',
  description: 'Upload a design or HTML file asset to a Stitch project as a new screen',
  requiredOptions: [
    { flags: '-p, --project <id>', description: 'Project ID to upload the asset into' },
    { flags: '-f, --file <path>', description: 'Path to the asset file (PNG, JPG, JPEG, WEBP, HTML)' },
  ],
  options: [
    { flags: '--title <title>', description: 'Optional display title for the created screen' },
  ],
  action: async (_args, options) => {
    try {
      // "Parse, don't validate"
      const input = UploadInputSchema.parse({
        projectId: options.project,
        filePath: options.file,
        title: options.title,
      });

      const { UploadHandler } = await import('./handler.js');


      // Production Dependency Implementation
      const uploadFn = async (projectId: string, filePath: string, title: string | undefined) => {
        const { stitch } = await import('@google/stitch-sdk');
        const project = stitch.project(projectId);
        const screens = await project.upload(filePath, { title });
        return screens.map(s => ({ screenId: s.screenId, projectId: s.projectId }));
      };

      const handler = new UploadHandler({ upload: uploadFn });
      const result = await handler.execute(input);

      if (!result.success) {
        console.error(theme.red(`\n${icons.error} Upload failed: ${result.error.message}`));
        process.exit(1);
      }

      console.log(theme.green(`\n${icons.success} Successfully uploaded asset to project ${input.projectId}:`));
      for (const s of result.screens) {
        console.log(`  ${icons.success} screenId: ${theme.cyan(s.screenId)}`);
      }
      process.exit(0);
    } catch (error: any) {
      console.error(theme.red(`\n${icons.error} Unexpected error:`), error?.message ?? String(error));
      process.exit(1);
    }
  },
};

