import { type DoctorCommand, type DoctorInput, type DoctorResult } from './spec.js';
import { GcloudHandler } from '../../services/gcloud/handler.js';
import { type GcloudService } from '../../services/gcloud/spec.js';
import { StitchHandler } from '../../services/stitch/handler.js';
import { type StitchService } from '../../services/stitch/spec.js';
import { theme, icons } from '../../ui/theme.js';
import { createSpinner } from '../../ui/spinner.js';
import { ConsoleUI } from '../../framework/ConsoleUI.js';
import { type DoctorContext } from './context.js';
import { type CommandStep } from '../../framework/CommandStep.js';
import { runSteps } from '../../framework/StepRunner.js';
import dotenv from 'dotenv';

import { ApiKeyDetectedStep } from './steps/ApiKeyDetectedStep.js';
import { GcloudCheckStep } from './steps/GcloudCheckStep.js';
import { AuthCheckStep } from './steps/AuthCheckStep.js';
import { AdcCheckStep } from './steps/AdcCheckStep.js';
import { ProjectCheckStep } from './steps/ProjectCheckStep.js';
import { ApiKeyConnectionStep } from './steps/ApiKeyConnectionStep.js';
import { ApiCheckStep } from './steps/ApiCheckStep.js';

export class DoctorHandler implements DoctorCommand {
  private steps: CommandStep<DoctorContext>[];

  constructor(
    private readonly gcloudService: GcloudService = new GcloudHandler(),
    private readonly stitchService: StitchService = new StitchHandler()
  ) {
    this.steps = [
      new ApiKeyDetectedStep(),
      new GcloudCheckStep(),
      new AuthCheckStep(),
      new AdcCheckStep(),
      new ProjectCheckStep(),
      new ApiKeyConnectionStep(),
      new ApiCheckStep(),
    ];
  }

  async execute(input: DoctorInput): Promise<DoctorResult> {
    dotenv.config();
    const apiKey = process.env.STITCH_API_KEY;

    const context: DoctorContext = {
      input,
      ui: new ConsoleUI(),
      gcloudService: this.gcloudService,
      stitchService: this.stitchService,
      authMode: apiKey ? 'apiKey' : 'oauth',
      apiKey: apiKey || undefined,
      checks: []
    };

    console.log(`\n${theme.blue('Stitch Doctor')}\n`);

    try {
      let spinner: ReturnType<typeof createSpinner>;
      await runSteps(this.steps, context, {
        onBeforeStep: (step) => {
          spinner = createSpinner();
          spinner.start(step.name);
        },
        onAfterStep: (_step, result) => {
          if (result.success) {
            spinner.succeed(result.detail || 'Passed');
          } else {
            spinner.fail(result.error?.message || 'Failed');
          }
          return false; // always continue
        },
      });

      // Summary
      const allPassed = context.checks.every((c) => c.passed);
      console.log(`\n${theme.blue('─'.repeat(60))}\n`);
      console.log(theme.blue('Health Check Summary\n'));

      for (const check of context.checks) {
        const icon = check.passed ? theme.green(icons.success) : theme.red(icons.error);
        console.log(`${icon} ${check.name}: ${check.message}`);
        if (check.suggestion && !check.passed) {
          console.log(theme.gray(`  → ${check.suggestion}`));
        }
      }

      // Show full error details for failed checks if verbose is enabled
      if (input.verbose) {
        const failedChecksWithDetails = context.checks.filter(c => !c.passed && c.details);
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
          checks: context.checks,
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
