import { StitchToolClient } from '@google/stitch-sdk';
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
  private tools: VirtualTool[];
  private steps: CommandStep<ToolContext>[];

  constructor(client?: any, tools?: VirtualTool[]) {
    this.client = client || new StitchToolClient();
    this.tools = tools || defaultVirtualTools;
    this.steps = [
      new deps.ListToolsStep(),
      new deps.ShowSchemaStep(),
      new deps.ParseArgsStep(),
      new deps.ValidateToolStep(),
      new deps.ExecuteToolStep(),
    ];
  }

  async execute(input: ToolCommandInput): Promise<ToolCommandResult> {
    const context: ToolContext = {
      input,
      client: this.client,
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
