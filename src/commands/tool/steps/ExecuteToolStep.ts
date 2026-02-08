import type { CommandStep, StepResult } from '../../../framework/CommandStep.js';
import type { ToolContext } from '../context.js';

export class ExecuteToolStep implements CommandStep<ToolContext> {
  id = 'execute-tool';
  name = 'Execute tool';

  async shouldRun(context: ToolContext): Promise<boolean> {
    return context.parsedArgs !== undefined;
  }

  async run(context: ToolContext): Promise<StepResult> {
    const toolName = context.input.toolName!;
    const args = context.parsedArgs!;

    // Check if it's a virtual tool
    const virtualTool = context.virtualTools.find(t => t.name === toolName);
    if (virtualTool) {
      try {
        const result = await virtualTool.execute(context.client, args);
        context.result = { success: true, data: result };
        return { success: true };
      } catch (e: any) {
        context.result = { success: false, error: `Virtual tool execution failed: ${e.message || String(e)}` };
        return { success: false, error: e };
      }
    }

    const result = await context.client.callTool(toolName, args);
    context.result = { success: true, data: result };
    return { success: true };
  }
}
