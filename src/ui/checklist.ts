import { confirm } from '@inquirer/prompts';
import { theme, icons } from './theme.js';
import { createSpinner } from './spinner.js';
import { execCommand } from '../platform/shell.js';

/**
 * Result of a verification check
 */
export interface VerifyResult {
  success: boolean;
  message?: string;
}

/**
 * A single step in the checklist
 */
export interface ChecklistStep {
  id: string;
  title: string;
  command: string;
  instruction?: string;
  verifyCommand?: string[];
  verifyFn?: () => Promise<VerifyResult>;
  env?: Record<string, string>;
}

/**
 * Options for running the checklist
 */
export interface ChecklistOptions {
  autoVerify: boolean;
  startingStepNumber?: number;
}

/**
 * Result of running the checklist
 */
export interface ChecklistResult {
  success: boolean;
  completedSteps: string[];
  failedStep?: string;
  error?: string;
}

/**
 * Copy text to clipboard, fails silently if not available
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const { default: clipboard } = await import('clipboardy');
    const result = await Promise.race([
      clipboard.write(text).then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 200)),
    ]);
    return result;
  } catch {
    return false;
  }
}

/**
 * Format a command for display
 */
function formatCommand(command: string): string {
  return `  ${theme.cyan(command)}`;
}

/**
 * Display a step header
 */
function displayStepHeader(title: string): void {
  console.log(`\n${title}\n`);
}

/**
 * Display the command to run
 */
function displayCommand(command: string): void {
  console.log(formatCommand(command));
  console.log('');
}

/**
 * Prompt user to mark step as complete
 */
async function waitForCompletion(): Promise<boolean> {
  return await confirm({
    message: 'Press Enter when complete',
    default: true,
  });
}

/**
 * Run a verification command
 */
async function runVerification(
  step: ChecklistStep,
  env?: Record<string, string>
): Promise<VerifyResult> {
  if (step.verifyFn) {
    return await step.verifyFn();
  }

  if (step.verifyCommand) {
    const result = await execCommand(step.verifyCommand, { env });
    if (result.success && result.stdout.trim()) {
      return {
        success: true,
        message: result.stdout.trim().split('\n')[0],
      };
    }
    // Command failed OR returned empty output (e.g., no accounts found)
    return {
      success: false,
      message: result.stderr?.trim() || 'Not configured',
    };
  }

  // No verification defined, assume success
  return { success: true };
}

/**
 * Verify all steps upfront to determine which can be skipped
 */
export async function verifyAllSteps(
  steps: ChecklistStep[],
  env?: Record<string, string>
): Promise<Map<string, VerifyResult>> {
  const results = new Map<string, VerifyResult>();

  for (const step of steps) {
    if (step.verifyCommand || step.verifyFn) {
      const result = await runVerification(step, env);
      results.set(step.id, result);
    }
  }

  return results;
}

/**
 * Checklist runner - guides user through steps
 */
export class Checklist {
  private completedSteps: string[] = [];
  private env: Record<string, string> = {};

  /**
   * Run the checklist
   */
  async run(steps: ChecklistStep[], options: ChecklistOptions): Promise<ChecklistResult> {
    let stepNumber = options.startingStepNumber || 1;

    for (const step of steps) {
      displayStepHeader(step.title);

      if (step.instruction) {
        console.log(`  ${theme.yellow(step.instruction)}\n`);
      }

      displayCommand(step.command);

      // Try to copy to clipboard
      const copied = await copyToClipboard(step.command);
      if (copied) {
        console.log(theme.gray('  (copied to clipboard)'));
      }

      // Wait for user to complete the step
      let completed = true;
      if (!options.autoVerify) {
        completed = await waitForCompletion();
      }

      if (!completed) {
        return {
          success: false,
          completedSteps: this.completedSteps,
          failedStep: step.id,
          error: 'User cancelled',
        };
      }

      // Merge step env with accumulated env
      if (step.env) {
        this.env = { ...this.env, ...step.env };
      }

      // Verify the step
      if (step.verifyCommand || step.verifyFn) {
        const spinner = createSpinner();
        spinner.start('Verifying...');

        const result = await runVerification(step, this.env);

        if (result.success) {
          const msg = result.message
            ? `${icons.success} ${result.message}`
            : `${icons.success} Complete`;
          spinner.succeed(msg);
        } else {
          spinner.fail(`Verification failed: ${result.message || 'Unknown error'}`);

          if (options.autoVerify) {
            return {
              success: false,
              completedSteps: this.completedSteps,
              failedStep: step.id,
              error: result.message,
            };
          }

          // Ask if they want to retry
          const retry = await confirm({
            message: 'Would you like to retry this step?',
            default: true,
          });

          if (retry) {
            stepNumber--; // Will increment back at start of loop
            continue;
          }

          return {
            success: false,
            completedSteps: this.completedSteps,
            failedStep: step.id,
            error: result.message,
          };
        }
      } else {
        console.log(theme.green(`  ${icons.success} Complete`));
      }

      this.completedSteps.push(step.id);
      stepNumber++;
    }

    return {
      success: true,
      completedSteps: this.completedSteps,
    };
  }
}

/**
 * Create a new checklist runner
 */
export function createChecklist(): Checklist {
  return new Checklist();
}
