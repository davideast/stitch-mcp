import { type DoctorInput } from './spec.js';
import { type UserInterface } from '../../framework/UserInterface.js';
import { type GcloudService } from '../../services/gcloud/spec.js';
import { type StitchService } from '../../services/stitch/spec.js';

export interface DoctorContext {
  // Input
  input: DoctorInput;

  // Dependencies
  ui: UserInterface;
  gcloudService: GcloudService;
  stitchService: StitchService;

  // State
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    suggestion?: string;
    details?: string;
  }>;
}
