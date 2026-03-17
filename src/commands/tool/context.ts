import type { StitchToolClient, Stitch } from '@google/stitch-sdk';
import type { ToolCommandInput, ToolCommandResult, VirtualTool } from './spec.js';

export interface ToolContext {
  // Immutable
  input: ToolCommandInput;
  client: StitchToolClient;
  stitch: Stitch;
  virtualTools: VirtualTool[];
  // Mutable (set by steps)
  parsedArgs?: Record<string, any>;
  result?: ToolCommandResult;
}
