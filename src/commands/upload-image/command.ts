import { type CommandDefinition } from '../../framework/CommandDefinition.js';
import { theme, icons } from '../../ui/theme.js';
import { UploadImageInputSchema, type UploadImageInput } from './spec.js';

export const command: CommandDefinition<any, any> = {
  name: 'upload-image',
  description: 'Upload an image file to a Stitch project as a new screen',
  requiredOptions: [
    { flags: '-p, --project <id>', description: 'Project ID to upload the image into' },
    { flags: '-f, --file <path>', description: 'Path to the image file (PNG, JPG, JPEG, WEBP)' },
  ],
  options: [
    { flags: '--title <title>', description: 'Optional display title for the created screen' },
  ],
  action: async (_args, options) => {
    try {
      // "Parse, don't validate"
      const input = UploadImageInputSchema.parse({
        projectId: options.project,
        filePath: options.file,
        title: options.title,
      });

      const { UploadImageHandler } = await import('./handler.js');


      // Production Dependency Implementation
      const uploadFn = async (projectId: string, filePath: string, title: string | undefined) => {
        const { stitch } = await import('@google/stitch-sdk');
        const project = stitch.project(projectId);
        const screens = await project.uploadImage(filePath, { title });
        return screens.map(s => ({ screenId: s.screenId, projectId: s.projectId }));
      };

      const handler = new UploadImageHandler({ uploadImage: uploadFn });
      const result = await handler.execute(input);

      if (!result.success) {
        console.error(theme.red(`\n${icons.error} Upload failed: ${result.error.message}`));
        process.exit(1);
      }

      console.log(theme.green(`\n${icons.success} Successfully uploaded image to project ${input.projectId}:`));
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
