import { describe, test, expect, mock } from 'bun:test';
import { runSteps } from './StepRunner.js';
import { type CommandStep, type StepResult } from './CommandStep.js';

function createStep(
  id: string,
  result: StepResult,
  shouldRun = true,
): CommandStep<any> {
  return {
    id,
    name: `Step ${id}`,
    run: mock(() => Promise.resolve(result)),
    shouldRun: mock(() => Promise.resolve(shouldRun)),
  };
}

describe('StepRunner', () => {
  test('runs all steps when no stop', async () => {
    const steps = [
      createStep('a', { success: true }),
      createStep('b', { success: true }),
      createStep('c', { success: true }),
    ];

    const result = await runSteps(steps, {});

    expect(result.completed).toBe(true);
    expect(result.results).toHaveLength(3);
    expect(result.stoppedAt).toBeUndefined();
    for (const step of steps) {
      expect(step.run).toHaveBeenCalledTimes(1);
    }
  });

  test('stops on callback returning true', async () => {
    const steps = [
      createStep('a', { success: true }),
      createStep('b', { success: false, error: new Error('fail') }),
      createStep('c', { success: true }),
    ];

    const result = await runSteps(steps, {}, {
      onAfterStep: (_step, res) => !res.success, // stop on failure
    });

    expect(result.completed).toBe(false);
    expect(result.results).toHaveLength(2);
    expect(result.stoppedAt).toEqual({
      step: 'b',
      result: { success: false, error: new Error('fail') },
    });
    expect(steps[2].run).not.toHaveBeenCalled();
  });

  test('skips steps where shouldRun is false', async () => {
    const onSkippedStep = mock();
    const steps = [
      createStep('a', { success: true }),
      createStep('b', { success: true }, false), // should be skipped
      createStep('c', { success: true }),
    ];

    const result = await runSteps(steps, {}, { onSkippedStep });

    expect(result.completed).toBe(true);
    expect(result.results).toHaveLength(2); // b not in results
    expect(steps[1].run).not.toHaveBeenCalled();
    expect(onSkippedStep).toHaveBeenCalledTimes(1);
    expect(onSkippedStep).toHaveBeenCalledWith(steps[1], {});
  });

  test('calls callbacks in order: onBeforeStep -> run -> onAfterStep', async () => {
    const callOrder: string[] = [];
    const step: CommandStep<any> = {
      id: 'x',
      name: 'Step x',
      run: mock(async () => {
        callOrder.push('run');
        return { success: true };
      }),
      shouldRun: mock(() => Promise.resolve(true)),
    };

    await runSteps([step], {}, {
      onBeforeStep: () => { callOrder.push('before'); },
      onAfterStep: () => { callOrder.push('after'); return false; },
    });

    expect(callOrder).toEqual(['before', 'run', 'after']);
  });

  test('works with no callbacks', async () => {
    const steps = [
      createStep('a', { success: true }),
      createStep('b', { success: false }),
      createStep('c', { success: true }),
    ];

    const result = await runSteps(steps, {});

    expect(result.completed).toBe(true);
    expect(result.results).toHaveLength(3);
    // All steps run even on failure since no callback stops execution
    for (const step of steps) {
      expect(step.run).toHaveBeenCalledTimes(1);
    }
  });
});
