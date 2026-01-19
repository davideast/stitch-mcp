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
import { promptMcpClient, promptConfirm, promptTransportType, type McpClient } from '../../ui/wizard.js';
import { theme, icons } from '../../ui/theme.js';
import { createChecklist, verifyAllSteps, type ChecklistStep } from '../../ui/checklist.js';

export interface Wizard {
  promptMcpClient: typeof promptMcpClient;
  promptConfirm: typeof promptConfirm;
  promptTransportType: typeof promptTransportType;
}
import { getGcloudSdkPath } from '../../platform/detector.js';
import { detectEnvironment } from '../../platform/environment.js';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { commandExists, execCommand } from '../../platform/shell.js';

// Assuming these types are defined elsewhere or are the handler classes themselves
// type GcloudService = GcloudHandler;
// type ProjectService = ProjectHandler;
// type StitchService = StitchHandler;
// type McpConfigService = McpConfigHandler;

export class InitHandler implements InitCommand {
  constructor(
    private readonly gcloudService: GcloudService = new GcloudHandler(),
    private readonly mcpConfigService: McpConfigService = new McpConfigHandler(),
    private readonly projectService: ProjectService = new ProjectHandler(new GcloudHandler()), // ProjectHandler depends on GcloudHandler
    private readonly stitchService: StitchService = new StitchHandler(),
    private readonly wizard: Wizard = {
      promptMcpClient,
      promptConfirm,
      promptTransportType
    },
    private readonly cwd: string = process.cwd()
  ) { }

  async execute(input: InitInput): Promise<InitResult> {
    try {
      console.log(`\n${theme.blue('Stitch MCP Setup')}\n`);

      // Initialize services (now done via constructor injection)

      // Step 1: MCP Client Selection
      console.log(theme.gray('Step 1: Select your MCP client\n'));

      let mcpClient: McpClient;
      if (input.client) {
        mcpClient = this.resolveMcpClient(input.client);
        console.log(theme.green(`${icons.success} Selected (via flag): ${mcpClient}\n`));
      } else {
        mcpClient = await this.wizard.promptMcpClient();
        console.log(theme.green(`${icons.success} Selected: ${mcpClient}\n`));
      }

      // Step 2: gcloud Installation
      console.log(theme.gray('Step 2: Setting up Google Cloud CLI\n'));
      const spinner = createSpinner();
      spinner.start('Checking for Google Cloud CLI...');

      const gcloudResult = await this.gcloudService.ensureInstalled({
        minVersion: '400.0.0',
        forceLocal: input.local,
      });

      if (!gcloudResult.success) {
        spinner.fail('Google Cloud CLI setup failed');
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

      spinner.succeed(
        `Google Cloud CLI ready (${gcloudResult.data.location}): v${gcloudResult.data.version}`
      );
      console.log(theme.gray(`  Location: ${gcloudResult.data.path}\n`));

      // Determine gcloud path for checklist commands
      const gcloudPath = gcloudResult.data.path;
      const isBundled = gcloudResult.data.location === 'bundled';
      const gcloudBinDir = path.dirname(gcloudPath);

      // Build auth checklist steps
      const authSteps: ChecklistStep[] = [];

      // If bundled, add PATH setup step
      if (isBundled) {
        authSteps.push({
          id: 'path-setup',
          title: 'Configure gcloud PATH (this terminal session)',
          command: `export PATH="${gcloudBinDir}:$PATH"`,
          // No verification - verified indirectly when gcloud commands work
        });
      }

      // Detect environment for auth guidance
      const env = detectEnvironment();

      // For WSL/problematic environments, show guidance rather than --no-browser
      // (--no-browser has its own complexity with --remote-bootstrap)
      if (env.needsNoBrowser && env.reason) {
        console.log(theme.yellow(`  ⚠ ${env.reason}`));
        console.log(theme.gray('  If browser auth fails, copy the URL from terminal and open manually.\n'));
      }

      // Config path for commands to save to bundled location
      const configPath = path.dirname(gcloudBinDir) + '/../config';
      const configPrefix = `CLOUDSDK_CONFIG="${configPath}"`;

      // User auth step
      authSteps.push({
        id: 'user-auth',
        title: 'Authenticate with Google Cloud',
        command: `${configPrefix} gcloud auth login`,
        verifyFn: async () => {
          const account = await this.gcloudService.getActiveAccount();
          return {
            success: !!account,
            message: account ? `Logged in as ${account}` : 'No account found',
          };
        },
      });

      // ADC step
      authSteps.push({
        id: 'adc',
        title: 'Authorize Application Default Credentials',
        command: `${configPrefix} gcloud auth application-default login`,
        verifyFn: async () => {
          const hasADC = await this.gcloudService.hasADC();
          return {
            success: hasADC,
            message: hasADC ? 'ADC configured' : 'ADC not found',
          };
        },
      });

      // Check current state upfront
      console.log(theme.gray('Step 3: Setup Authentication\n'));

      let stepsToRun = authSteps;
      const checkState = input.autoVerify ||
        await this.wizard.promptConfirm('Check your current setup status?', true);

      if (checkState) {
        const spinner2 = createSpinner();
        spinner2.start('Checking current state...');
        const verified = await verifyAllSteps(authSteps);
        spinner2.stop();

        // Filter to only steps that need to be run
        const completedSteps: string[] = [];
        for (const step of authSteps) {
          const result = verified.get(step.id);
          if (result?.success) {
            console.log(theme.green(`  ${icons.success} ${step.title}: ${result.message || 'Complete'} (skipping)`));
            completedSteps.push(step.id);
          }
        }

        stepsToRun = authSteps.filter(s => !completedSteps.includes(s.id));

        if (stepsToRun.length === 0) {
          console.log(theme.green(`\n  ${icons.success} All authentication steps already complete\n`));
        } else {
          console.log('');
        }
      }

      // Run remaining auth steps via checklist
      if (stepsToRun.length > 0) {
        const checklist = createChecklist();
        const checklistResult = await checklist.run(stepsToRun, {
          autoVerify: input.autoVerify,
        });

        if (!checklistResult.success) {
          return {
            success: false,
            error: {
              code: 'AUTH_FAILED',
              message: checklistResult.error || 'Authentication setup failed',
              suggestion: 'Complete the authentication steps and try again',
              recoverable: true,
            },
          };
        }
      }

      // Get the authenticated account for later steps
      const authAccount = await this.gcloudService.getActiveAccount();
      if (!authAccount) {
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

      console.log(theme.green(`${icons.success} Authenticated as: ${authAccount}\n`));

      // Step 5: Transport Selection
      console.log(theme.gray('Step 5: Choose connection method\n'));

      let transport: 'http' | 'stdio';
      if (input.transport) {
        transport = this.resolveTransport(input.transport);
        console.log(theme.green(`${icons.success} Selected (via flag): ${transport === 'http' ? 'Direct' : 'Proxy'}\n`));
      } else {
        transport = await this.wizard.promptTransportType();
        console.log(theme.green(`${icons.success} Selected: ${transport === 'http' ? 'Direct' : 'Proxy'}\n`));
      }

      // Step 6: Project Selection
      console.log(theme.gray('Step 6: Select a Google Cloud project\n'));

      let projectResult: ProjectSelectionResult | null = null;
      const activeProjectId = await this.gcloudService.getProjectId();

      if (activeProjectId) {
        const detailsResult = await this.projectService.getProjectDetails({ projectId: activeProjectId });
        if (detailsResult.success) {
          const useActive = input.defaults ? true : await this.wizard.promptConfirm(
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
        return {
          success: false,
          error: {
            code: 'PROJECT_SELECTION_FAILED',
            message: projectResult.error.message,
            suggestion: projectResult.error.suggestion,
            recoverable: projectResult.error.recoverable,
          },
        };
      }



      // Step 6: Set Active Project
      spinner.start('Configuring project...');

      const setProjectResult = await this.gcloudService.setProject({
        projectId: projectResult.data.projectId,
      });

      if (!setProjectResult.success) {
        spinner.fail('Failed to set active project');
        return {
          success: false,
          error: {
            code: 'API_CONFIG_FAILED',
            message: setProjectResult.error.message,
            recoverable: setProjectResult.error.recoverable,
          },
        };
      }

      spinner.succeed(`Selected project: ${theme.blue(projectResult.data.name)} (${theme.gray(projectResult.data.projectId)})`);

      // Step 7: Configure IAM permissions
      console.log(`\n${theme.gray('Step 7: Configure IAM Permissions')}`);
      const iamCheckSpinner = createSpinner();
      iamCheckSpinner.start('Checking IAM permissions...');
      const hasIAMRole = await this.stitchService.checkIAMRole({
        projectId: projectResult.data.projectId,
        userEmail: authAccount,
      });
      iamCheckSpinner.stop();

      if (hasIAMRole) {
        console.log(theme.green(`${icons.success} Required IAM role is already configured.\n`));
      } else {
        const shouldConfigureIam = await this.wizard.promptConfirm(
          'Add the required IAM role (serviceusage.serviceUsageConsumer) to your account?',
          true
        );

        if (shouldConfigureIam) {
          spinner.start('Configuring IAM permissions...');
          const iamResult = await this.stitchService.configureIAM({
            projectId: projectResult.data.projectId,
            userEmail: authAccount,
          });

          if (iamResult.success) {
            spinner.succeed('IAM permissions configured');
            console.log(theme.gray(`  Role: ${iamResult.data.role}`));
          } else {
            spinner.fail('IAM configuration failed');
            console.log(theme.yellow(`  ${iamResult.error.message}`));
            if (iamResult.error.details) {
              console.log(theme.gray(`\n  Details:\n${iamResult.error.details.split('\n').map((line: string) => `  ${line}`).join('\n')}`));
            }
            console.log(theme.gray(`  This may not prevent API usage if permissions already exist\n`));
          }
        } else {
          console.log(theme.yellow('  ⚠ Skipping IAM configuration. API calls may fail if permissions are missing.\n'));
        }
      }

      // Step 8: Install Beta Components
      spinner.start('Installing gcloud beta components...');

      const betaResult = await this.gcloudService.installBetaComponents();

      if (betaResult.success) {
        spinner.succeed('Beta components installed');
      } else {
        spinner.fail('Beta component installation failed');
        console.log(theme.yellow(`  ${betaResult.error?.message}`));
        console.log(theme.gray(`  Continuing anyway...\n`));
      }

      console.log(''); // Add spacing to prevent flickering

      // Step 9: Enable Stitch API
      const apiCheckSpinner = createSpinner();
      apiCheckSpinner.start('Checking Stitch API status...');
      const isApiEnabled = await this.stitchService.checkAPIEnabled({
        projectId: projectResult.data.projectId,
      });
      apiCheckSpinner.stop();

      if (isApiEnabled) {
        console.log(theme.green(`${icons.success} Stitch API is already enabled.\n`));
      } else {
        spinner.start('Enabling Stitch API...');
        const apiResult = await this.stitchService.enableAPI({
          projectId: projectResult.data.projectId,
        });

        if (apiResult.success) {
          spinner.succeed('Stitch API enabled');
          console.log(theme.gray(`  API: ${apiResult.data.api}\n`));
        } else {
          spinner.fail('API enablement failed');
          console.log(theme.yellow(`  ${apiResult.error.message}`));
          if (apiResult.error.details) {
            console.log(theme.gray(`\n  Details:\n${apiResult.error.details.split('\n').map((line: string) => `  ${line}`).join('\n')}`));
          }
          console.log(theme.gray(`  You may need to enable it manually\n`));
        }
      }

      console.log(''); // Add spacing to prevent flickering

      // Step 10: Get Access Token

      // Get access token for config generation and testing
      const accessToken = await this.gcloudService.getAccessToken();

      if (!accessToken) {
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

      // Step 10: Generate MCP Config
      // Special setup for Gemini CLI
      if (mcpClient === 'gemini-cli') {
        await this.setupGeminiExtension(projectResult.data.projectId, transport);
      }

      console.log(`\n${theme.gray('Step 8: Generating MCP Configuration')}\n`);
      spinner.start('Generating MCP configuration...');

      // Save to package.json if user consents
      const savedToPackage = await this.detectAndSaveContext(projectResult.data.projectId);

      const configResult = await this.mcpConfigService.generateConfig({
        client: mcpClient,
        projectId: projectResult.data.projectId,
        accessToken,
        transport,
        // Only inject env var if NOT saved to package.json
        env: savedToPackage ? undefined : { STITCH_PROJECT_ID: projectResult.data.projectId }
      });

      if (!configResult.success) {
        spinner.fail('Configuration generation failed');
        return {
          success: false,
          error: {
            code: 'CONFIG_GENERATION_FAILED',
            message: configResult.error.message,
            recoverable: configResult.error.recoverable,
          },
        };
      }

      spinner.succeed('Configuration generated');

      // Display results
      console.log(`\n${theme.blue('Setup Complete!')} ${icons.success}\n`);
      console.log(configResult.data.instructions);

      // Final Step: Test Connection (displayed at the end for visibility)
      console.log(`\n${theme.blue('─'.repeat(60))}\n`);
      console.log(theme.gray('Connection Test\n'));
      const spinner2 = createSpinner();
      spinner2.start('Testing API connection...');

      const testResult = await this.stitchService.testConnection({
        projectId: projectResult.data.projectId,
        accessToken,
      });

      if (!testResult.success) {
        spinner2.fail('Connection Failed');
        console.log(theme.red(`\n  ${icons.error} Error: ${testResult.error.message}`));
        console.log(theme.yellow(`  ${testResult.error.suggestion}`));

        // Show full error details if available (may contain helpful URLs)
        if (testResult.error.details) {
          console.log(theme.gray(`\n  Full API Response:\n`));
          console.log(theme.gray(testResult.error.details.split('\n').map(line => `  ${line}`).join('\n')));
        }

        console.log(theme.red(`\n  ⚠️  You may need to fix authentication or permissions before using Stitch.\n`));
      } else {
        spinner2.succeed(`Connection Successful (${testResult.data.statusCode})`);
        console.log(theme.green(`  ${icons.success} Stitch API is ready to use!\n`));
      }

      return {
        success: true,
        data: {
          projectId: projectResult.data.projectId,
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

  private resolveMcpClient(input: string): McpClient {
    const map: Record<string, McpClient> = {
      'antigravity': 'antigravity', 'agy': 'antigravity',
      'vscode': 'vscode', 'vsc': 'vscode',
      'cursor': 'cursor', 'cur': 'cursor',
      'claude-code': 'claude-code', 'cc': 'claude-code',
      'gemini-cli': 'gemini-cli', 'gcli': 'gemini-cli'
    };

    const normalized = input.trim().toLowerCase();
    const client = map[normalized];
    if (!client) {
      throw new Error(`Invalid client '${input}'. Supported: antigravity (agy), vscode (vsc), cursor (cur), claude-code (cc), gemini-cli (gcli)`);
    }
    return client;
  }

  private resolveTransport(input: string): 'http' | 'stdio' {
    const normalized = input.trim().toLowerCase();
    if (normalized === 'http') return 'http';
    if (normalized === 'stdio') return 'stdio';
    throw new Error(`Invalid transport '${input}'. Supported: http, stdio`);
  }

  private async setupGeminiExtension(projectId: string, transport: 'http' | 'stdio'): Promise<void> {
    const spinner = createSpinner();
    const extensionPath = path.join(os.homedir(), '.gemini', 'extensions', 'Stitch', 'gemini-extension.json');
    const isInstalled = fs.existsSync(extensionPath);

    if (isInstalled) {
      spinner.succeed('Stitch extension is already installed');
    } else {
      console.log(theme.gray('  > gemini extensions install https://github.com/gemini-cli-extensions/stitch'));

      const shouldInstall = await this.wizard.promptConfirm(
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

      console.log(theme.gray(`  File: ${extensionPath}`));

    } catch (e) {
      spinner.fail('Failed to update extension configuration');
      console.log(theme.red(`  Error: ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  async detectAndSaveContext(projectId: string): Promise<boolean> {
    const pkgPath = path.join(this.cwd, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return false;
    }

    const shouldSave = await this.wizard.promptConfirm(
      `Found package.json. Save Project ID "${projectId}" to it?`
    );

    if (shouldSave) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.stitch = { ...pkg.stitch, projectId };
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
        console.log(theme.green(`✓ Saved Project ID to package.json`));
        return true;
      } catch (e) {
        console.warn(theme.yellow(`Could not save to package.json: ${e}`));
        return false;
      }
    }
    return false;
  }
}
