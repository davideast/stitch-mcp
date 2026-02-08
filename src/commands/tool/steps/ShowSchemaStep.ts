import type { CommandStep, StepResult } from '../../../framework/CommandStep.js';
import type { ToolContext } from '../context.js';
import type { ToolInfo } from '../spec.js';

export class ShowSchemaStep implements CommandStep<ToolContext> {
  id = 'show-schema';
  name = 'Show tool schema';

  async shouldRun(context: ToolContext): Promise<boolean> {
    return !!context.input.toolName && context.input.toolName !== 'list' && context.input.showSchema;
  }

  async run(context: ToolContext): Promise<StepResult> {
    const toolName = context.input.toolName!;

    // Get all tools to find the one we need
    const result = await context.client.getCapabilities();
    const serverTools = result.tools || [];
    const allTools = [...context.virtualTools, ...serverTools];
    const tool = allTools.find(t => t.name === toolName);

    if (!tool) {
      context.result = { success: false, error: `Tool not found: ${toolName}` };
      return { success: false, error: new Error(`Tool not found: ${toolName}`) };
    }

    context.result = { success: true, data: this.formatSchema(tool) };
    return { success: true };
  }

  private formatSchema(tool: ToolInfo): object {
    const schema = tool.inputSchema;
    const args: Record<string, string> = {};

    if (schema?.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        const required = schema.required?.includes(key) ? '(required)' : '(optional)';
        args[key] = `${prop.type} ${required}${prop.description ? ' - ' + prop.description : ''}`;
      }
    }

    return {
      name: tool.name,
      description: tool.description,
      arguments: args,
      example: this.generateExample(tool),
    };
  }

  private generateExample(tool: ToolInfo): string {
    const exampleArgs: Record<string, any> = {};
    if (tool.inputSchema?.properties) {
      for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
        exampleArgs[key] = prop.type === 'string' ? `<${key}>` : `<${prop.type}>`;
      }
    }
    return `stitch-mcp tool ${tool.name} -d '${JSON.stringify(exampleArgs)}'`;
  }
}
