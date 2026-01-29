import { type InitCommand, type InitInput, type InitResult } from './spec.js';
import { GcloudHandler } from '../../services/gcloud/handler.js';
import { type GcloudService } from '../../services/gcloud/spec.js';
import { ProjectHandler } from '../../services/project/handler.js';
import { type ProjectService, type ProjectSelectionResult } from '../../services/project/spec.js';
import { StitchHandler } from '../../services/stitch/handler.js';
import { type StitchService } from '../../services/stitch/spec.js';
import { McpConfigHandler } from '../../services/mcp-config/handler.js';
import { type McpConfigService } from '../../services/mcp-config/spec.js';
import { createSpinner } from '../../ui/spinner.js';
import { promptMcpClient, promptConfirm, promptTransportType, promptAuthMode, promptApiKeyStorage, promptApiKey, type McpClient } from '../../ui/wizard.js';
import { theme, icons } from '../../ui/theme.js';
import { ChecklistUIHandler } from '../../ui/checklist/handler.js';
import type { ChecklistItemStateType } from '../../ui/checklist/spec.js';
import { detectEnvironment } from '../../platform/environment.js';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execCommand } from '../../platform/shell.js';

// Checklist step IDs
const STEPS = {
  CLIENT: 'mcp-client',
  AUTH_MODE: 'authentication-mode',
  GCLOUD: 'gcloud-cli',
  AUTH: 'authentication',
  CONNECTION: 'connection-method',
  PROJECT: 'project-selection',
  IAM_API: 'iam-and-api',
  CONFIG: 'mcp-config',
  TEST: 'connection-test',
} as const;

export class InitHandler implements InitCommand {
  private readonly gcloudService: GcloudService;
  private readonly mcpConfigService: McpConfigService;
  private readonly projectService: ProjectService;
  private readonly stitchService: StitchService;
  private checklist: ChecklistUIHandler;

  constructor(
    gcloudService?: GcloudService,
    mcpConfigService?: McpConfigService,
    projectService?: ProjectService,
    stitchService?: StitchService
  ) {
    this.gcloudService = gcloudService || new GcloudHandler();
    this.mcpConfigService = mcpConfigService || new McpConfigHandler();
    this.projectService = projectService || new ProjectHandler(this.gcloudService);
    this.stitchService = stitchService || new StitchHandler();
    this.checklist = new ChecklistUIHandler();
  }

  async execute(input: InitInput): Promise<InitResult> {
    try {
      // Initialize the checklist
      this.checklist.initialize({
        title: 'Stitch MCP Setup',
        items: [
          { id: STEPS.CLIENT, label: 'Select MCP client' },
          { id: STEPS.AUTH_MODE, label: 'Select Authentication Mode' },
          { id: STEPS.GCLOUD, label: 'Install Google Cloud CLI' },
          { id: STEPS.AUTH, label: 'Authenticate with Google' },
          { id: STEPS.CONNECTION, label: 'Choose connection method' },
          { id: STEPS.PROJECT, label: 'Select Google Cloud project' },
          { id: STEPS.IAM_API, label: 'Configure IAM & enable API' },
          { id: STEPS.CONFIG, label: 'Generate MCP configuration' },
          { id: STEPS.TEST, label: 'Test connection' },
        ],
        showProgress: true,
        animationDelayMs: 100,
      });

      // Show header - steps will print progressively as they complete
      console.log(`\n${theme.blue('🧵 Stitch MCP Setup')}\n`);

      // ─────────────────────────────────────────────────────────────────────
      // Step 1: MCP Client Selection
      // ─────────────────────────────────────────────────────────────────────
      this.updateStep(STEPS.CLIENT, 'IN_PROGRESS');

      let mcpClient: McpClient;
      if (input.client) {
        mcpClient = this.resolveMcpClient(input.client);
        this.updateStep(STEPS.CLIENT, 'SKIPPED', mcpClient, 'Set via --client flag');
      } else {
        mcpClient = await promptMcpClient();
        this.updateStep(STEPS.CLIENT, 'COMPLETE', mcpClient);
      }

      // ─────────────────────────────────────────────────────────────────────
      // Step 2: Authentication Mode
      // ─────────────────────────────────────────────────────────────────────
      this.updateStep(STEPS.AUTH_MODE, 'IN_PROGRESS');

      const authMode = await promptAuthMode();
      let apiKey: string | undefined;
      let accessToken: string | undefined;
      let projectId = 'ignored-project-id';
      let transport: 'http' | 'stdio' = 'http';

      if (authMode === 'apiKey') {
        const storage = await promptApiKeyStorage();
        if (storage === 'config') {
          apiKey = await promptApiKey();
        } else if (storage === 'skip') {
          apiKey = 'YOUR-API-KEY';
        } else if (storage === '.env') {
          const inputKey = await promptApiKey();
          apiKey = 'YOUR-API-KEY';

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
            console.log(theme.yellow(`  Warning: Failed to update .env or .gitignore: ${e instanceof Error ? e.message : String(e)}`));
          }
        }

        this.updateStep(STEPS.AUTH_MODE, 'COMPLETE', 'API Key');

        // Skip irrelevant steps
        this.updateStep(STEPS.GCLOUD, 'SKIPPED', 'Not required for API Key');
        this.updateStep(STEPS.AUTH, 'SKIPPED', 'Using API Key');

        if (input.transport) {
          transport = this.resolveTransport(input.transport);
          const transportLabel = transport === 'http' ? 'Direct' : 'Proxy';
          this.updateStep(STEPS.CONNECTION, 'SKIPPED', transportLabel, 'Set via --transport flag');
        } else {
          transport = await promptTransportType('apiKey');
          const transportLabel = transport === 'http' ? 'Direct' : 'Proxy';
          this.updateStep(STEPS.CONNECTION, 'COMPLETE', transportLabel);
        }

        this.updateStep(STEPS.PROJECT, 'SKIPPED', 'Not required for API Key');
        this.updateStep(STEPS.IAM_API, 'SKIPPED', 'Not required for API Key');
        this.updateStep(STEPS.TEST, 'SKIPPED', 'Not supported for API Key yet');

      } else {
        this.updateStep(STEPS.AUTH_MODE, 'COMPLETE', 'OAuth');

        // ─────────────────────────────────────────────────────────────────────
        // Step 3: gcloud Installation
        // ─────────────────────────────────────────────────────────────────────
        this.updateStep(STEPS.GCLOUD, 'IN_PROGRESS');

        const gcloudResult = await this.gcloudService.ensureInstalled({
          minVersion: '400.0.0',
          forceLocal: input.local,
        });

        if (!gcloudResult.success) {
          this.updateStep(STEPS.GCLOUD, 'FAILED', gcloudResult.error.message);
          return {
            success: false,
            error: {
              code: 'GCLOUD_SETUP_FAILED',
              message: gcloudResult.error.message,
              suggestion: gcloudResult.error.suggestion,
              recoverable: gcloudResult.error.recoverable,
            },
          };
        }

        this.updateStep(
          STEPS.GCLOUD,
          'COMPLETE',
          `v${gcloudResult.data.version} (${gcloudResult.data.location})`
        );

        // ─────────────────────────────────────────────────────────────────────
        // Step 4: Authentication
        // ─────────────────────────────────────────────────────────────────────
        this.updateStep(STEPS.AUTH, 'IN_PROGRESS');

        // Detect environment for auth guidance
        const env = detectEnvironment();
        if (env.needsNoBrowser && env.reason) {
          console.log(theme.yellow(`\n  ⚠ ${env.reason}`));
          console.log(theme.gray('  If browser auth fails, copy the URL from terminal and open manually.\n'));
        }

        // Check existing auth state
        const existingAccount = await this.gcloudService.getActiveAccount();
        const hasADC = await this.gcloudService.hasADC();

        if (existingAccount && hasADC) {
          this.updateStep(STEPS.AUTH, 'SKIPPED', existingAccount, 'Already authenticated');
        } else {
          // Need to guide through auth
          const isBundled = gcloudResult.data.location === 'bundled';
          const gcloudBinDir = path.dirname(gcloudResult.data.path);
          let configPrefix = '';
          if (isBundled) {
            const configPath = path.dirname(gcloudBinDir) + '/../config';
            configPrefix = `CLOUDSDK_CONFIG="${configPath}"`;

            // PATH setup for bundled gcloud
            console.log(theme.yellow('\nConfigure gcloud PATH\n'));
            console.log('  Open a NEW terminal tab/window and run this command:\n');
            console.log(theme.cyan(`  export PATH="${gcloudBinDir}:$PATH"\n`));

            try {
              const { default: clipboard } = await import('clipboardy');
              await clipboard.write(`export PATH="${gcloudBinDir}:$PATH"`);
              console.log(theme.gray('  (copied to clipboard)'));
            } catch { /* clipboard not available */ }

            await promptConfirm('Press Enter when complete', true);
          }

          // User auth
          if (!existingAccount) {
            console.log(theme.yellow('\nAuthenticate with Google Cloud\n'));
            console.log(theme.cyan(`  ${configPrefix} gcloud auth login\n`));
            await promptConfirm('Press Enter when complete', true);
          }

          // ADC auth
          if (!hasADC) {
            console.log(theme.yellow('\nAuthorize Application Default Credentials\n'));
            console.log(theme.cyan(`  ${configPrefix} gcloud auth application-default login\n`));
            await promptConfirm('Press Enter when complete', true);
          }

          const verifyAccount = await this.gcloudService.getActiveAccount();
          if (!verifyAccount) {
            this.updateStep(STEPS.AUTH, 'FAILED', 'No account found');
            return {
              success: false,
              error: {
                code: 'AUTH_FAILED',
                message: 'No authenticated account found after setup',
                suggestion: 'Run gcloud auth login and try again',
                recoverable: true,
              },
            };
          }
          this.updateStep(STEPS.AUTH, 'COMPLETE', verifyAccount);
        }

        const authAccount = await this.gcloudService.getActiveAccount();
        if (!authAccount) {
          return {
            success: false,
            error: {
              code: 'AUTH_FAILED',
              message: 'No authenticated account found',
              suggestion: 'Run gcloud auth login and try again',
              recoverable: true,
            },
          };
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 5: Transport Selection
        // ─────────────────────────────────────────────────────────────────────
        this.updateStep(STEPS.CONNECTION, 'IN_PROGRESS');

        if (input.transport) {
          transport = this.resolveTransport(input.transport);
          const transportLabel = transport === 'http' ? 'Direct' : 'Proxy';
          this.updateStep(STEPS.CONNECTION, 'SKIPPED', transportLabel, 'Set via --transport flag');
        } else {
          transport = await promptTransportType();
          const transportLabel = transport === 'http' ? 'Direct' : 'Proxy';
          this.updateStep(STEPS.CONNECTION, 'COMPLETE', transportLabel);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Step 6: Project Selection
        // ─────────────────────────────────────────────────────────────────────
        this.updateStep(STEPS.PROJECT, 'IN_PROGRESS');

        let projectResult: ProjectSelectionResult | null = null;
        const activeProjectId = await this.gcloudService.getProjectId();

        if (activeProjectId) {
          const detailsResult = await this.projectService.getProjectDetails({ projectId: activeProjectId });
          if (detailsResult.success) {
            const useActive = (input.defaults || input.autoVerify) ? true : await promptConfirm(
              `Use active project: ${detailsResult.data.name} (${detailsResult.data.projectId})?`,
              true
            );
            if (useActive) {
              projectResult = detailsResult;
            }
          }
        }

        if (!projectResult) {
          projectResult = await this.projectService.selectProject({
            allowSearch: true,
            limit: 5,
          });
        }

        if (!projectResult.success) {
          const error = (projectResult as any).error || { message: 'Unknown error', recoverable: false };
          this.updateStep(STEPS.PROJECT, 'FAILED', error.message);
          return {
            success: false,
            error: {
              code: 'PROJECT_SELECTION_FAILED',
              message: error.message,
              suggestion: error.suggestion,
              recoverable: error.recoverable,
            },
          };
        }

        // Set active project
        const setProjectResult = await this.gcloudService.setProject({
          projectId: projectResult.data.projectId,
        });

        if (!setProjectResult.success) {
          const error = (setProjectResult as any).error || { message: 'Unknown error', recoverable: false };
          this.updateStep(STEPS.PROJECT, 'FAILED', 'Failed to set project');
          return {
            success: false,
            error: {
              code: 'API_CONFIG_FAILED',
              message: error.message,
              recoverable: error.recoverable,
            },
          };
        }

        projectId = projectResult.data.projectId;
        this.updateStep(STEPS.PROJECT, 'COMPLETE', projectId);

        // ─────────────────────────────────────────────────────────────────────
        // Step 7: Configure IAM & Enable API
        // ─────────────────────────────────────────────────────────────────────
        this.updateStep(STEPS.IAM_API, 'IN_PROGRESS');

        const spinner = createSpinner();

        // Check and configure IAM
        const hasIAMRole = await this.stitchService.checkIAMRole({
          projectId: projectId,
          userEmail: authAccount,
        });

        if (!hasIAMRole) {
          const shouldConfigureIam = input.autoVerify || await promptConfirm(
            'Add the required IAM role to your account?',
            true
          );

          if (shouldConfigureIam) {
            await this.stitchService.configureIAM({
              projectId: projectId,
              userEmail: authAccount,
            });
          }
        }

        // Install beta components
        await this.gcloudService.installBetaComponents();

        // Check and enable API
        const isApiEnabled = await this.stitchService.checkAPIEnabled({
          projectId: projectId,
        });

        if (!isApiEnabled) {
          await this.stitchService.enableAPI({
            projectId: projectId,
          });
        }

        this.updateStep(STEPS.IAM_API, 'COMPLETE', 'Ready');

        // Get Access Token for OAuth flow
        accessToken = await this.gcloudService.getAccessToken() || undefined;
        if (!accessToken) {
          this.updateStep(STEPS.CONFIG, 'FAILED', 'No access token');
          return {
            success: false,
            error: {
              code: 'API_CONFIG_FAILED',
              message: 'Could not obtain access token',
              suggestion: 'Re-run the authentication steps',
              recoverable: true,
            },
          };
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Step 8: Generate MCP Config
      // ─────────────────────────────────────────────────────────────────────
      this.updateStep(STEPS.CONFIG, 'IN_PROGRESS');

      // Special setup for Gemini CLI
      if (mcpClient === 'gemini-cli') {
        await this.setupGeminiExtension(projectId, transport, apiKey);
      }

      const configResult = await this.mcpConfigService.generateConfig({
        client: mcpClient,
        projectId,
        accessToken,
        transport,
        authMode,
        apiKey,
      });

      if (!configResult.success) {
        const error = (configResult as any).error || { message: 'Unknown error', recoverable: false };
        this.updateStep(STEPS.CONFIG, 'FAILED', error.message);
        return {
          success: false,
          error: {
            code: 'CONFIG_GENERATION_FAILED',
            message: error.message,
            recoverable: error.recoverable,
          },
        };
      }

      this.updateStep(STEPS.CONFIG, 'COMPLETE', 'Generated');

      // ─────────────────────────────────────────────────────────────────────
      // Step 9: Test Connection (Conditional)
      // ─────────────────────────────────────────────────────────────────────
      if (authMode === 'oauth' && accessToken) {
        this.updateStep(STEPS.TEST, 'IN_PROGRESS');

        const testResult = await this.stitchService.testConnection({
          projectId,
          accessToken,
        });

        if (!testResult.success) {
          const error = (testResult as any).error || { message: 'Unknown error', suggestion: '' };
          this.updateStep(STEPS.TEST, 'FAILED', error.message);
          console.log(theme.red(`\n  ${icons.error} Error: ${error.message}`));
          console.log(theme.yellow(`  ${error.suggestion}`));
        } else {
          this.updateStep(STEPS.TEST, 'COMPLETE', `${testResult.data.statusCode} OK`);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Final Summary
      // ─────────────────────────────────────────────────────────────────────
      const { percent } = this.checklist.getProgress();
      const barWidth = 40;
      const filled = Math.round((percent / 100) * barWidth);
      const bar = '━'.repeat(filled) + '─'.repeat(barWidth - filled);
      console.log(`\n  ${bar} ${percent}%`);

      if (this.checklist.isComplete()) {
        console.log(`\n${theme.green('🎉 Setup complete!')}\n`);
      }

      console.log(configResult.data.instructions);

      return {
        success: true,
        data: {
          projectId,
          mcpConfig: configResult.data.config,
          instructions: configResult.data.instructions,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  /**
   * Helper to update checklist item state and print the completed step
   */
  private updateStep(
    stepId: string,
    state: ChecklistItemStateType,
    detail?: string,
    reason?: string
  ): void {
    this.checklist.updateItem({ itemId: stepId, state, detail, reason });

    // Only print completed/skipped/failed steps (not IN_PROGRESS)
    if (state !== 'IN_PROGRESS') {
      this.printStepResult(stepId, state, detail, reason);
    }
  }

  /**
   * Print a single step result line
   */
  private printStepResult(
    stepId: string,
    state: ChecklistItemStateType,
    detail?: string,
    reason?: string
  ): void {
    const stepIndex = Object.values(STEPS).indexOf(stepId as any);
    const stepNum = stepIndex + 1;
    const labels: Record<string, string> = {
      [STEPS.CLIENT]: 'Select MCP client',
      [STEPS.AUTH_MODE]: 'Select Authentication Mode',
      [STEPS.GCLOUD]: 'Install Google Cloud CLI',
      [STEPS.AUTH]: 'Authenticate with Google',
      [STEPS.CONNECTION]: 'Choose connection method',
      [STEPS.PROJECT]: 'Select Google Cloud project',
      [STEPS.IAM_API]: 'Configure IAM & enable API',
      [STEPS.CONFIG]: 'Generate MCP configuration',
      [STEPS.TEST]: 'Test connection',
    };
    const label = labels[stepId] || stepId;

    const icons: Record<ChecklistItemStateType, string> = {
      PENDING: '○',
      IN_PROGRESS: '▸',
      COMPLETE: '✓',
      SKIPPED: '−',
      FAILED: '✗',
    };
    const icon = icons[state];

    const colors: Record<ChecklistItemStateType, (s: string) => string> = {
      PENDING: theme.gray,
      IN_PROGRESS: theme.yellow,
      COMPLETE: theme.green,
      SKIPPED: theme.gray,
      FAILED: theme.red,
    };
    const color = colors[state];

    let line = `  ${color(icon)}  ${stepNum}. ${label}`;
    if (detail) {
      line += ` ${theme.gray('·')} ${detail}`;
    }
    console.log(line);

    if (reason) {
      console.log(`     └─ ${theme.gray(reason)}`);
    }
  }

  private resolveMcpClient(input: string): McpClient {
    const map: Record<string, McpClient> = {
      'antigravity': 'antigravity', 'agy': 'antigravity',
      'vscode': 'vscode', 'vsc': 'vscode',
      'cursor': 'cursor', 'cur': 'cursor',
      'claude-code': 'claude-code', 'cc': 'claude-code',
      'gemini-cli': 'gemini-cli', 'gcli': 'gemini-cli',
      'codex': 'codex', 'cdx': 'codex',
      'opencode': 'opencode', 'opc': 'opencode'
    };

    const normalized = input.trim().toLowerCase();
    const client = map[normalized];
    if (!client) {
      throw new Error(`Invalid client '${input}'. Supported: antigravity (agy), vscode (vsc), cursor (cur), claude-code (cc), gemini-cli (gcli), codex (cdx), opencode (opc)`);
    }
    return client;
  }

  private resolveTransport(input: string): 'http' | 'stdio' {
    const normalized = input.trim().toLowerCase();
    if (normalized === 'http') return 'http';
    if (normalized === 'stdio') return 'stdio';
    throw new Error(`Invalid transport '${input}'. Supported: http, stdio`);
  }

  private async setupGeminiExtension(projectId: string, transport: 'http' | 'stdio', apiKey?: string): Promise<void> {
    const spinner = createSpinner();
    const extensionPath = path.join(os.homedir(), '.gemini', 'extensions', 'Stitch', 'gemini-extension.json');
    const isInstalled = fs.existsSync(extensionPath);

    if (isInstalled) {
      spinner.succeed('Stitch extension is already installed');
    } else {
      console.log(theme.gray('  > gemini extensions install https://github.com/gemini-cli-extensions/stitch'));

      const shouldInstall = await promptConfirm(
        'Run this command?',
        true
      );

      if (shouldInstall) {
        spinner.start('Installing Stitch extension...');

        const installResult = await execCommand(['gemini', 'extensions', 'install', 'https://github.com/gemini-cli-extensions/stitch']);

        if (!installResult.success) {
          spinner.fail('Failed to install Stitch extension');
          console.log(theme.red(`  Error: ${installResult.stderr || installResult.error}`));
          console.log(theme.gray('  Attempting to configure existing extension...'));
        } else {
          spinner.succeed('Extension installed');
        }
      }
    }

    spinner.start('Configuring extension...');

    if (!fs.existsSync(extensionPath)) {
      spinner.fail('Extension configuration file not found');
      console.log(theme.gray(`  Expected path: ${extensionPath}`));
      return;
    }

    try {
      const content = fs.readFileSync(extensionPath, 'utf8');
      const config = JSON.parse(content);

      if (!config.mcpServers?.stitch) {
        spinner.fail('Invalid extension configuration format detected');
        return;
      }

      if (transport === 'stdio') {
        config.mcpServers.stitch = {
          command: 'npx',
          args: ['@_davideast/stitch-mcp', 'proxy'],
          env: {
            STITCH_PROJECT_ID: projectId,
            PATH: process.env.PATH || '',
          },
        };

        fs.writeFileSync(extensionPath, JSON.stringify(config, null, 4));
        spinner.succeed(`Stitch extension configured for STDIO: Project ID set to ${theme.blue(projectId)}`);
      } else {
        // HTTP
        const existingHeaders = config.mcpServers.stitch.headers || {};
        if (apiKey) {
             config.mcpServers.stitch = {
                url: 'https://stitch.googleapis.com/mcp',
                headers: {
                    ...existingHeaders,
                    'X-Goog-Api-Key': apiKey,
                },
             };
             // Ensure optional deletion of other headers if they were there
             delete config.mcpServers.stitch.headers['Authorization'];
             delete config.mcpServers.stitch.headers['X-Goog-User-Project'];

             fs.writeFileSync(extensionPath, JSON.stringify(config, null, 4));
             spinner.succeed(`Stitch extension configured for HTTP with API Key`);
        } else {
            config.mcpServers.stitch = {
              url: 'https://stitch.googleapis.com/mcp',
              headers: {
                'Authorization': 'Bearer $STITCH_ACCESS_TOKEN',
                ...existingHeaders,
                'X-Goog-User-Project': projectId,
              },
            };
            fs.writeFileSync(extensionPath, JSON.stringify(config, null, 4));
            spinner.succeed(`Stitch extension configured for HTTP: Project ID set to ${theme.blue(projectId)}`);
        }
      }

      console.log(theme.gray(`  File: ${extensionPath}`));

    } catch (e) {
      spinner.fail('Failed to update extension configuration');
      console.log(theme.red(`  Error: ${e instanceof Error ? e.message : String(e)}`));
    }
  }
}
