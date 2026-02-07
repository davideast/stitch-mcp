import { type CommandStep, type StepResult } from './CommandStep.js';

export interface StepRunnerCallbacks<T> {
  /** Called before each step runs. Use for UI (start spinner, set checklist IN_PROGRESS). */
  onBeforeStep?: (step: CommandStep<T>, context: T) => void;

  /** Called after each step runs. Return `true` to stop executing further steps. */
  onAfterStep?: (step: CommandStep<T>, result: StepResult, context: T) => boolean;

  /** Called when shouldRun() returns false. */
  onSkippedStep?: (step: CommandStep<T>, context: T) => void;
}

export interface StepRunnerResult {
  results: StepResult[];
  /** True if all steps completed (none stopped early). */
  completed: boolean;
  /** The result that triggered early stop, if any. */
  stoppedAt?: { step: string; result: StepResult };
}

export async function runSteps<T>(
  steps: CommandStep<T>[],
  context: T,
  callbacks?: StepRunnerCallbacks<T>,
): Promise<StepRunnerResult> {
  const results: StepResult[] = [];

  for (const step of steps) {
    if (await step.shouldRun(context)) {
      callbacks?.onBeforeStep?.(step, context);
      const result = await step.run(context);
      results.push(result);

      const shouldStop = callbacks?.onAfterStep?.(step, result, context) ?? false;
      if (shouldStop) {
        return { results, completed: false, stoppedAt: { step: step.id, result } };
      }
    } else {
      callbacks?.onSkippedStep?.(step, context);
    }
  }

  return { results, completed: true };
}
