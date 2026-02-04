import { StitchMCPClient } from '../../services/mcp-client/client.js';
import type { ToolCommandInput, ToolCommandResult, ToolInfo } from './spec.js';

export class ToolCommandHandler {
  private client: StitchMCPClient;

  constructor(client?: StitchMCPClient) {
    this.client = client || new StitchMCPClient();
  }

  async listTools(): Promise<ToolInfo[]> {
    const result = await this.client.getCapabilities();
    return result.tools || [];
  }

  async getToolSchema(toolName: string): Promise<ToolInfo | null> {
    const tools = await this.listTools();
    return tools.find(t => t.name === toolName) || null;
  }

  async execute(input: ToolCommandInput): Promise<ToolCommandResult> {
    // No tool name = list all tools
    if (!input.toolName) {
      const tools = await this.listTools();
      return { success: true, data: tools };
    }

    // --schema flag = show tool arguments
    if (input.showSchema) {
      const tool = await this.getToolSchema(input.toolName);
      if (!tool) {
        return { success: false, error: `Tool not found: ${input.toolName}` };
      }
      return { success: true, data: this.formatSchema(tool) };
    }

    // Parse args from -d or @file
    let args: Record<string, any> = {};
    if (input.data) {
      args = JSON.parse(input.data);
    } else if (input.dataFile) {
      const content = await Bun.file(input.dataFile.replace('@', '')).text();
      args = JSON.parse(content);
    }

    const result = await this.client.callTool(input.toolName, args);
    return { success: true, data: result };
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
