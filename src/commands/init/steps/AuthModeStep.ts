import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type InitContext } from '../context.js';
import fs from 'node:fs';
import path from 'node:path';

export class AuthModeStep implements CommandStep<InitContext> {
  id = 'authentication-mode';
  name = 'Select Authentication Mode';

  async shouldRun(context: InitContext): Promise<boolean> {
    return true;
  }

  async run(context: InitContext): Promise<StepResult> {
    const authMode = await context.ui.promptAuthMode();
    context.authMode = authMode;

    if (authMode === 'apiKey') {
      const storage = await context.ui.promptApiKeyStorage();
      if (storage === 'config') {
        context.apiKey = await context.ui.promptApiKey();
      } else if (storage === 'skip') {
        context.apiKey = 'YOUR-API-KEY';
      } else if (storage === '.env') {
        const inputKey = await context.ui.promptApiKey();
        context.apiKey = 'YOUR-API-KEY';

        // Handle .env file
        const envPath = path.join(process.cwd(), '.env');
        const envContent = `\nSTITCH_API_KEY=${inputKey}\n`;

        try {
          // fs.promises.appendFile creates the file if it does not exist
          await fs.promises.appendFile(envPath, envContent);

          // Handle .gitignore
          const gitignorePath = path.join(process.cwd(), '.gitignore');
          try {
            const gitignoreContent = await fs.promises.readFile(gitignorePath, 'utf8');
            if (!gitignoreContent.includes('.env')) {
              await fs.promises.appendFile(gitignorePath, '\n.env\n');
            }
          } catch (err: any) {
            if (err.code === 'ENOENT') {
              await fs.promises.writeFile(gitignorePath, '.env\n');
            } else {
              throw err;
            }
          }
        } catch (e) {
            context.ui.warn(`Warning: Failed to update .env or .gitignore: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      return {
        success: true,
        detail: 'API Key',
        status: 'COMPLETE'
      };
    }

    return {
      success: true,
      detail: 'OAuth',
      status: 'COMPLETE'
    };
  }
}
