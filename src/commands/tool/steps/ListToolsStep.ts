import type { CommandStep, StepResult } from '../../../framework/CommandStep.js';
import type { ToolContext } from '../context.js';

export class ListToolsStep implements CommandStep<ToolContext> {
  id = 'list-tools';
  name = 'List available tools';

  async shouldRun(context: ToolContext): Promise<boolean> {
    const name = context.input.toolName?.toLowerCase();
    return !name || name === 'list' || name === 'listtools' || name === 'list_tools';
  }

  async run(context: ToolContext): Promise<StepResult> {
    const result = await context.client.getCapabilities();
    const serverTools = result.tools || [];
    const tools = [...context.virtualTools, ...serverTools];
    context.result = { success: true, data: tools };
    return { success: true };
  }
}
