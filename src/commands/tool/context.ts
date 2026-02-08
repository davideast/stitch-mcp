import type { StitchMCPClient } from '../../services/mcp-client/client.js';
import type { ToolCommandInput, ToolCommandResult, VirtualTool } from './spec.js';

export interface ToolContext {
  // Immutable
  input: ToolCommandInput;
  client: StitchMCPClient;
  virtualTools: VirtualTool[];
  // Mutable (set by steps)
  parsedArgs?: Record<string, any>;
  result?: ToolCommandResult;
}
