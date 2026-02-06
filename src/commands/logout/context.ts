import { type LogoutInput } from './spec.js';
import { type UserInterface } from '../../framework/UserInterface.js';
import { type GcloudService } from '../../services/gcloud/spec.js';

export interface LogoutContext {
  // Input
  input: LogoutInput;

  // Dependencies
  ui: UserInterface;
  gcloudService: GcloudService;

  // State
  gcloudPath?: string;
  userRevoked: boolean;
  adcRevoked: boolean;
  configCleared: boolean;
}
