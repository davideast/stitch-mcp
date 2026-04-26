import { StitchToolClient, stitch as defaultStitch } from '@google/stitch-sdk';
import type { Stitch } from '@google/stitch-sdk';
import type { CommandStep } from '../../framework/CommandStep.js';
import { runSteps } from '../../framework/StepRunner.js';
import type { ToolCommandInput, ToolCommandResult, VirtualTool } from './spec.js';

import type { ToolContext } from './context.js';
import { virtualTools as defaultVirtualTools } from './virtual-tools/index.js';
import { ListToolsStep } from './steps/ListToolsStep.js';
import { ShowSchemaStep } from './steps/ShowSchemaStep.js';
import { ParseArgsStep } from './steps/ParseArgsStep.js';
import { ValidateToolStep } from './steps/ValidateToolStep.js';
import { ExecuteToolStep } from './steps/ExecuteToolStep.js';
import { LogExecuteToolStep } from './steps/LogExecuteToolStep.js';
import { createCaptureHandler, isLogEnabled } from '../../lib/log/factory.js';

export const deps = {
  runSteps,
  ListToolsStep,
  ShowSchemaStep,
  ParseArgsStep,
  ValidateToolStep,
  ExecuteToolStep,
};

export class ToolCommandHandler {
  private client: StitchToolClient;
  private stitchInstance: Stitch;
  private tools: VirtualTool[];
  private steps: CommandStep<ToolContext>[];

  constructor(client?: StitchToolClient, tools?: VirtualTool[], stitchInstance?: Stitch) {
    this.client = client || new StitchToolClient();
    this.stitchInstance = stitchInstance || defaultStitch;
    this.tools = tools || defaultVirtualTools;
    const executeStep: CommandStep<ToolContext> = isLogEnabled()
      ? new LogExecuteToolStep(createCaptureHandler())
      : new deps.ExecuteToolStep();
    this.steps = [
      new deps.ListToolsStep(),
      new deps.ShowSchemaStep(),
      new deps.ParseArgsStep(),
      new deps.ValidateToolStep(),
      executeStep,
    ];
  }

  async execute(input: ToolCommandInput): Promise<ToolCommandResult> {
    const context: ToolContext = {
      input,
      client: this.client,
      stitch: this.stitchInstance,
      virtualTools: this.tools,
    };

    try {
        await deps.runSteps(this.steps, context, {
        onAfterStep: (_step, _result, ctx) => ctx.result !== undefined,
        });
    } finally {
        await this.client.close();
    }

    return context.result ?? { success: false, error: 'No step produced a result' };
  }
}
