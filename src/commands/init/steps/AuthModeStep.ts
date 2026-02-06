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
          if (fs.existsSync(envPath)) {
            fs.appendFileSync(envPath, envContent);
          } else {
            fs.writeFileSync(envPath, envContent);
          }

          // Handle .gitignore
          const gitignorePath = path.join(process.cwd(), '.gitignore');
          if (fs.existsSync(gitignorePath)) {
            const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
            if (!gitignoreContent.includes('.env')) {
              fs.appendFileSync(gitignorePath, '\n.env\n');
            }
          } else {
            fs.writeFileSync(gitignorePath, '.env\n');
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
