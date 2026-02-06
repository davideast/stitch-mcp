import { type InitInput } from './spec.js';
import { type UserInterface } from '../../framework/UserInterface.js';
import { type GcloudService } from '../../services/gcloud/spec.js';
import { type McpConfigService } from '../../services/mcp-config/spec.js';
import { type ProjectService } from '../../services/project/spec.js';
import { type StitchService } from '../../services/stitch/spec.js';
import { type McpClient } from '../../ui/wizard.js';

export interface InitContext {
  // Input arguments
  input: InitInput;

  // Dependencies
  ui: UserInterface;
  gcloudService: GcloudService;
  mcpConfigService: McpConfigService;
  projectService: ProjectService;
  stitchService: StitchService;

  // Mutable State
  mcpClient?: McpClient;
  authMode?: 'apiKey' | 'oauth';
  apiKey?: string;
  accessToken?: string;
  projectId?: string;
  transport?: 'http' | 'stdio';
  authAccount?: string;
  instructions?: string;
  finalConfig?: string;
}
