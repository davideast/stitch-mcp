import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type InitContext } from '../context.js';
import { createSpinner } from '../../../ui/spinner.js';
import { theme } from '../../../ui/theme.js';
import { execCommand } from '../../../platform/shell.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export class ConfigStep implements CommandStep<InitContext> {
  id = 'mcp-config';
  name = 'Generate MCP configuration';

  async shouldRun(context: InitContext): Promise<boolean> {
    return true;
  }

  async run(context: InitContext): Promise<StepResult> {
    // Special setup for Gemini CLI
    if (context.mcpClient === 'gemini-cli') {
      await this.setupGeminiExtension(context);
    }

    const configResult = await context.mcpConfigService.generateConfig({
      client: context.mcpClient!,
      projectId: context.projectId || 'ignored-project-id',
      accessToken: context.accessToken,
      transport: context.transport!,
      authMode: context.authMode!,
      apiKey: context.apiKey,
    });

    if (!configResult.success) {
      const error = (configResult as any).error || { message: 'Unknown error' };
      return { success: false, error: new Error(error.message) };
    }

    context.instructions = configResult.data.instructions;
    context.finalConfig = configResult.data.config;

    return { success: true, detail: 'Generated' };
  }

  private async setupGeminiExtension(context: InitContext): Promise<void> {
    const spinner = createSpinner();
    const extensionPath = path.join(os.homedir(), '.gemini', 'extensions', 'Stitch', 'gemini-extension.json');
    let isInstalled = false;
    try {
      await fs.promises.access(extensionPath);
      isInstalled = true;
    } catch {
      isInstalled = false;
    }

    if (isInstalled) {
      spinner.succeed('Stitch extension is already installed');
    } else {
      context.ui.log(theme.gray('  > gemini extensions install https://github.com/gemini-cli-extensions/stitch'));

      const shouldInstall = await context.ui.promptConfirm(
        'Run this command?',
        true
      );

      if (shouldInstall) {
        spinner.start('Installing Stitch extension...');

        const installResult = await execCommand(['gemini', 'extensions', 'install', 'https://github.com/gemini-cli-extensions/stitch']);

        if (!installResult.success) {
          spinner.fail('Failed to install Stitch extension');
          context.ui.log(theme.red(`  Error: ${installResult.stderr || installResult.error}`));
          context.ui.log(theme.gray('  Attempting to configure existing extension...'));
        } else {
          spinner.succeed('Extension installed');
        }
      }
    }

    spinner.start('Configuring extension...');

    try {
      await fs.promises.access(extensionPath);
    } catch {
      spinner.fail('Extension configuration file not found');
      context.ui.log(theme.gray(`  Expected path: ${extensionPath}`));
      return;
    }

    try {
      const content = await fs.promises.readFile(extensionPath, 'utf8');
      const config = JSON.parse(content);

      if (!config.mcpServers?.stitch) {
        spinner.fail('Invalid extension configuration format detected');
        return;
      }

      if (context.transport === 'stdio') {
        const env: Record<string, string> = {
          PATH: process.env.PATH || '',
        };

        if (context.apiKey) {
          env.STITCH_API_KEY = context.apiKey;
        } else {
          env.STITCH_PROJECT_ID = context.projectId!;
        }

        config.mcpServers.stitch = {
          command: 'npx',
          args: ['@_davideast/stitch-mcp', 'proxy'],
          env,
        };

        await fs.promises.writeFile(extensionPath, JSON.stringify(config, null, 4));
        const successMsg = context.apiKey
          ? 'Stitch extension configured for STDIO with API Key'
          : `Stitch extension configured for STDIO: Project ID set to ${theme.blue(context.projectId!)}`;
        spinner.succeed(successMsg);
      } else {
        // HTTP
        const existingHeaders = config.mcpServers.stitch.headers || {};
        if (context.apiKey) {
             config.mcpServers.stitch = {
                url: 'https://stitch.googleapis.com/mcp',
                headers: {
                    ...existingHeaders,
                    'X-Goog-Api-Key': context.apiKey,
                },
             };
             // Ensure optional deletion of other headers if they were there
             if (config.mcpServers.stitch.headers['Authorization']) delete config.mcpServers.stitch.headers['Authorization'];
             if (config.mcpServers.stitch.headers['X-Goog-User-Project']) delete config.mcpServers.stitch.headers['X-Goog-User-Project'];

             await fs.promises.writeFile(extensionPath, JSON.stringify(config, null, 4));
             spinner.succeed(`Stitch extension configured for HTTP with API Key`);
        } else {
            config.mcpServers.stitch = {
              url: 'https://stitch.googleapis.com/mcp',
              headers: {
                'Authorization': 'Bearer $STITCH_ACCESS_TOKEN',
                ...existingHeaders,
                'X-Goog-User-Project': context.projectId!,
              },
            };
            await fs.promises.writeFile(extensionPath, JSON.stringify(config, null, 4));
            spinner.succeed(`Stitch extension configured for HTTP: Project ID set to ${theme.blue(context.projectId!)}`);
        }
      }

      context.ui.log(theme.gray(`  File: ${extensionPath}`));

    } catch (e) {
      spinner.fail('Failed to update extension configuration');
      context.ui.log(theme.red(`  Error: ${e instanceof Error ? e.message : String(e)}`));
    }
  }
}
