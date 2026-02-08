import { StitchMCPClient } from '../../services/mcp-client/client.js';
import type { CommandStep } from '../../framework/CommandStep.js';
import { runSteps } from '../../framework/StepRunner.js';
import type { ToolCommandInput, ToolCommandResult, VirtualTool } from './spec.js';
import type { ToolContext } from './context.js';
import { virtualTools as defaultVirtualTools } from './virtual-tools/index.js';
import { ListToolsStep } from './steps/ListToolsStep.js';
import { ShowSchemaStep } from './steps/ShowSchemaStep.js';
import { ParseArgsStep } from './steps/ParseArgsStep.js';
import { ExecuteToolStep } from './steps/ExecuteToolStep.js';

export class ToolCommandHandler {
  private client: StitchMCPClient;
  private tools: VirtualTool[];
  private steps: CommandStep<ToolContext>[];

  constructor(client?: StitchMCPClient, tools?: VirtualTool[]) {
    this.client = client || new StitchMCPClient();
    this.tools = tools || defaultVirtualTools;
    this.steps = [
      new ListToolsStep(),
      new ShowSchemaStep(),
      new ParseArgsStep(),
      new ExecuteToolStep(),
    ];
  }

  async execute(input: ToolCommandInput): Promise<ToolCommandResult> {
    const context: ToolContext = {
      input,
      client: this.client,
      virtualTools: this.tools,
    };

    await runSteps(this.steps, context, {
      onAfterStep: (_step, _result, ctx) => ctx.result !== undefined,
    });

    return context.result ?? { success: false, error: 'No step produced a result' };
  }
}
