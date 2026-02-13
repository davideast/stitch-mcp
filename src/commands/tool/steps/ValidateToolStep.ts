import type { CommandStep, StepResult } from '../../../framework/CommandStep.js';
import type { ToolContext } from '../context.js';

export class ValidateToolStep implements CommandStep<ToolContext> {
  id = 'validate-tool';
  name = 'Validate tool exists';

  async shouldRun(context: ToolContext): Promise<boolean> {
    return !!context.input.toolName
      && context.input.toolName !== 'list'
      && !context.input.showSchema
      && context.parsedArgs !== undefined;
  }

  async run(context: ToolContext): Promise<StepResult> {
    const toolName = context.input.toolName!;

    const result = await context.client.getCapabilities();
    const serverTools = result.tools || [];
    const allTools = [...context.virtualTools, ...serverTools];
    const found = allTools.find(t => t.name === toolName);

    if (!found) {
      const availableNames = allTools.map(t => t.name).sort();
      context.result = {
        success: false,
        error: `Tool not found: "${toolName}". Use "list_tools" to see available tools.`,
        data: {
          requestedTool: toolName,
          availableTools: availableNames,
          hint: 'Call "list_tools" to see all available tools with descriptions and schemas.',
        },
      };
      return { success: false, error: new Error(`Tool not found: ${toolName}`) };
    }

    return { success: true };
  }
}
