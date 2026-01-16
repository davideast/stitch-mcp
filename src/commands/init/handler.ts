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
import { promptMcpClient, promptConfirm, promptTransportType } from '../../ui/wizard.js';
import { theme, icons } from '../../ui/theme.js';

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
    private readonly stitchService: StitchService = new StitchHandler()
  ) { }

  async execute(input: InitInput): Promise<InitResult> {
    try {
      console.log(`\n${theme.blue('Stitch MCP Setup')}\n`);

      // Initialize services (now done via constructor injection)

      // Step 1: MCP Client Selection
      console.log(theme.gray('Step 1: Select your MCP client\n'));
      const mcpClient = await promptMcpClient();
      console.log(theme.green(`${icons.success} Selected: ${mcpClient}\n`));

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

      // Step 3: User Authentication
      console.log(theme.gray('Step 3: Authenticating with Google Cloud\n'));
      let activeAccount = await this.gcloudService.getActiveAccount();
      if (activeAccount) {
        const continueWithActive = await promptConfirm(
          `You are already logged in as ${activeAccount}. Continue?`,
          true
        );
        if (!continueWithActive) {
          activeAccount = null; // Force re-authentication
        }
      }

      const authResult = await this.gcloudService.authenticate({
        skipIfActive: Boolean(activeAccount),
      });

      if (!authResult.success) {
        return {
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: 'User authentication failed',
            suggestion: authResult.error.suggestion,
            recoverable: authResult.error.recoverable,
          },
        };
      }

      console.log(theme.green(`${icons.success} User authenticated: ${authResult.data.account}\n`));
      // Step 4: Application Default Credentials
      console.log(theme.gray('Step 4: Authorizing application credentials\n'));
      let hasADC = await this.gcloudService.hasADC();
      if (hasADC) {
        const useExistingADC = await promptConfirm(
          'Application Default Credentials (ADC) already exist. Use them?',
          true
        );
        if (!useExistingADC) {
          hasADC = false; // Force re-authentication
        }
      } else {
        console.log(
          theme.gray('  This is a separate auth process required for API access...\n')
        );
      }
      const adcResult = await this.gcloudService.authenticateADC({ skipIfActive: hasADC });

      if (!adcResult.success) {
        return {
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: 'Application credential authorization failed',
            suggestion: adcResult.error.suggestion,
            recoverable: adcResult.error.recoverable,
          },
        };
      }

      console.log(theme.green(`${icons.success} Application credentials ready\n`));

      // Step 5: Transport Selection
      console.log(theme.gray('Step 5: Choose connection method\n'));
      const transport = await promptTransportType();
      console.log(theme.green(`${icons.success} Selected: ${transport === 'http' ? 'Direct' : 'Proxy'}\n`));

      // Step 6: Project Selection
      console.log(theme.gray('Step 6: Select a Google Cloud project\n'));

      let projectResult: ProjectSelectionResult | null = null;
      const activeProjectId = await this.gcloudService.getProjectId();

      if (activeProjectId) {
        const detailsResult = await this.projectService.getProjectDetails({ projectId: activeProjectId });
        if (detailsResult.success) {
          const useActive = await promptConfirm(
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

      console.log(
        theme.green(
          `\n${icons.success} Selected project: ${projectResult.data.name} (${projectResult.data.projectId})\n`
        )
      );

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
        userEmail: authResult.data.account,
      });
      iamCheckSpinner.stop();

      if (hasIAMRole) {
        console.log(theme.green(`${icons.success} Required IAM role is already configured.\n`));
      } else {
        const shouldConfigureIam = await promptConfirm(
          'Add the required IAM role (serviceusage.serviceUsageConsumer) to your account?',
          true
        );

        if (shouldConfigureIam) {
          spinner.start('Configuring IAM permissions...');
          const iamResult = await this.stitchService.configureIAM({
            projectId: projectResult.data.projectId,
            userEmail: authResult.data.account,
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
        await this.setupGeminiExtension(projectResult.data.projectId);
      }

      console.log(`\n${theme.gray('Step 8: Generating MCP Configuration')}\n`);
      spinner.start('Generating MCP configuration...');

      const configResult = await this.mcpConfigService.generateConfig({
        client: mcpClient,
        projectId: projectResult.data.projectId,
        accessToken,
        transport,
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

  private async setupGeminiExtension(projectId: string): Promise<void> {
    const spinner = createSpinner();
    console.log(theme.gray('  > gemini extensions install https://github.com/gemini-cli-extensions/stitch'));

    const shouldInstall = await promptConfirm(
      'Run this command?',
      true
    );

    if (!shouldInstall) {
      return;
    }

    spinner.start('Installing Stitch extension...');

    const installResult = await execCommand(['gemini', 'extensions', 'install', 'https://github.com/gemini-cli-extensions/stitch']);

    if (!installResult.success) {
      spinner.fail('Failed to install Stitch extension');
      console.log(theme.red(`  Error: ${installResult.stderr || installResult.error}`));
      console.log(theme.gray('  Attempting to configure existing extension...'));
    } else {
      spinner.succeed('Extension installed');
    }

    spinner.start('Configuring extension...');

    const extensionPath = path.join(os.homedir(), '.gemini', 'extensions', 'Stitch', 'gemini-extension.json');

    if (!fs.existsSync(extensionPath)) {
      spinner.fail('Extension configuration file not found');
      console.log(theme.gray(`  Expected path: ${extensionPath}`));
      return;
    }

    try {
      const content = fs.readFileSync(extensionPath, 'utf8');
      const config = JSON.parse(content);

      // Update project ID in headers
      if (config.mcpServers?.stitch?.headers) {
        config.mcpServers.stitch.headers['X-Goog-User-Project'] = projectId;
        fs.writeFileSync(extensionPath, JSON.stringify(config, null, 4));
        spinner.succeed(`Stitch extension configured: Project ID set to ${theme.blue(projectId)}`);
        console.log(theme.gray(`  File: ${extensionPath}`));
      } else {
        spinner.fail('Invalid extension configuration format');
      }

    } catch (e) {
      spinner.fail('Failed to update extension configuration');
      console.log(theme.red(`  Error: ${e instanceof Error ? e.message : String(e)}`));
    }
  }
}
