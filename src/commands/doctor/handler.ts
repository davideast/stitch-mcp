import { type DoctorCommand, type DoctorInput, type DoctorResult, type HealthCheckSchema } from './spec.js';
import { GcloudHandler } from '../../services/gcloud/handler.js';
import { type GcloudService } from '../../services/gcloud/spec.js';
import { StitchHandler } from '../../services/stitch/handler.js';
import { type StitchService } from '../../services/stitch/spec.js';
import { theme, icons } from '../../ui/theme.js';
import { createSpinner } from '../../ui/spinner.js';

type HealthCheck = {
  name: string;
  passed: boolean;
  message: string;
  suggestion?: string;
  details?: string;
};

// type GcloudService = GcloudHandler;
// type StitchService = StitchHandler;

export class DoctorHandler implements DoctorCommand {
  constructor(
    private readonly gcloudService: GcloudService = new GcloudHandler(),
    private readonly stitchService: StitchService = new StitchHandler()
  ) { }

  async execute(input: DoctorInput): Promise<DoctorResult> {
    try {
      console.log(`\n${theme.blue('Stitch Doctor')}\n`);

      const checks: HealthCheck[] = [];
      // const gcloudService = new GcloudHandler();
      // const stitchService = new StitchHandler();

      // Check 1: gcloud installation
      const spinner = createSpinner();
      spinner.start('Checking Google Cloud CLI...');

      const gcloudResult = await this.gcloudService.ensureInstalled({
        minVersion: '400.0.0',
        forceLocal: false,
      });

      if (gcloudResult.success) {
        const check = {
          name: 'Google Cloud CLI',
          passed: true,
          message: `Installed (${gcloudResult.data.location}): v${gcloudResult.data.version}\n   Path: ${gcloudResult.data.path}`,
        };
        checks.push(check);
        spinner.succeed(check.message);
      } else {
        const check = {
          name: 'Google Cloud CLI',
          passed: false,
          message: 'Not found or invalid version',
          suggestion: 'Run: npx @_davideast/stitch-mcp init',
        };
        checks.push(check);
        spinner.fail(check.message);
      }

      // Check 2: User authentication
      spinner.start('Checking user authentication...');

      const authResult = await this.gcloudService.authenticate({ skipIfActive: true });

      if (authResult.success) {
        const check = {
          name: 'User Authentication',
          passed: true,
          message: `Authenticated: ${authResult.data.account}`,
        };
        checks.push(check);
        spinner.succeed(check.message);
      } else {
        const check = {
          name: 'User Authentication',
          passed: false,
          message: 'Not authenticated',
          suggestion: 'Run: gcloud auth login',
        };
        checks.push(check);
        spinner.fail(check.message);
      }

      // Check 3: Application default credentials
      spinner.start('Checking application credentials...');

      const adcResult = await this.gcloudService.authenticateADC({ skipIfActive: true });

      if (adcResult.success) {
        const check = {
          name: 'Application Credentials',
          passed: true,
          message: 'Present',
        };
        checks.push(check);
        spinner.succeed(check.message);
      } else {
        const check = {
          name: 'Application Credentials',
          passed: false,
          message: 'Not configured',
          suggestion: 'Run: gcloud auth application-default login',
        };
        checks.push(check);
        spinner.fail(check.message);
      }

      // Check 4: Active project
      spinner.start('Checking active project...');

      const projectId = await this.gcloudService.getProjectId();

      if (projectId) {
        const check = {
          name: 'Active Project',
          passed: true,
          message: `Set: ${projectId}`,
        };
        checks.push(check);
        spinner.succeed(check.message);

        // Check 5: API connection (only if we have a project)
        spinner.start('Testing Stitch API...');

        const accessToken = await this.gcloudService.getAccessToken();

        if (accessToken) {
          const testResult = await this.stitchService.testConnection({
            projectId,
            accessToken,
          });

          if (testResult.success) {
            const check = {
              name: 'Stitch API',
              passed: true,
              message: `Healthy (${testResult.data.statusCode})`,
            };
            checks.push(check);
            spinner.succeed(check.message);
          } else {
            const check = {
              name: 'Stitch API',
              passed: false,
              message: testResult.error.message,
              suggestion: testResult.error.suggestion,
              details: testResult.error.details,
            };
            checks.push(check);
            spinner.fail(check.message);
          }
        } else {
          const check = {
            name: 'Stitch API',
            passed: false,
            message: 'Could not obtain access token',
            suggestion: 'Re-run authentication',
          };
          checks.push(check);
          spinner.fail(check.message);
        }
      } else {
        const check = {
          name: 'Active Project',
          passed: false,
          message: 'No project configured',
          suggestion: 'Run: npx @_davideast/stitch-mcp init',
        };
        checks.push(check);
        spinner.fail(check.message);
      }

      // Summary
      const allPassed = checks.every((c) => c.passed);
      console.log(`\n${theme.blue('─'.repeat(60))}\n`);
      console.log(theme.blue('Health Check Summary\n'));

      for (const check of checks) {
        const icon = check.passed ? theme.green(icons.success) : theme.red(icons.error);
        console.log(`${icon} ${check.name}: ${check.message}`);
        if (check.suggestion && !check.passed) {
          console.log(theme.gray(`  → ${check.suggestion}`));
        }
      }

      // Show full error details for failed checks if verbose is enabled
      if (input.verbose) {
        const failedChecksWithDetails = checks.filter(c => !c.passed && c.details);
        if (failedChecksWithDetails.length > 0) {
          console.log(`\n${theme.blue('Detailed Error Information')}\n`);
          for (const check of failedChecksWithDetails) {
            console.log(theme.yellow(`${check.name}:`));
            console.log(theme.gray(check.details!.split('\n').map(line => `  ${line}`).join('\n')));
            console.log('');
          }
        }
      }

      console.log(
        `\n${allPassed ? theme.green('All checks passed!') : theme.yellow('Some checks failed')}\n`
      );

      return {
        success: true,
        data: {
          checks,
          allPassed,
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
}
