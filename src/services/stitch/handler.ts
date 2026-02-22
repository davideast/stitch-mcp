import {
  type StitchService,
  type ConfigureIAMInput,
  type EnableAPIInput,
  type TestConnectionInput,
  type TestConnectionWithApiKeyInput,
  type IAMConfigResult,
  type APIEnableResult,
  type ConnectionTestResult,
} from './spec.js';
import { GcloudExecutor } from '../gcloud/core.js';
import { StitchIamService } from './iam.js';
import { StitchApiService } from './api.js';
import { StitchConnectionService } from './connection.js';

export class StitchHandler implements StitchService {
  private executor: GcloudExecutor;
  private iamService: StitchIamService;
  private apiService: StitchApiService;
  private connectionService: StitchConnectionService;

  constructor() {
    this.executor = new GcloudExecutor();
    this.iamService = new StitchIamService(this.executor);
    this.apiService = new StitchApiService(this.executor);
    this.connectionService = new StitchConnectionService();
  }

  async configureIAM(input: ConfigureIAMInput): Promise<IAMConfigResult> {
    return this.iamService.configureIAM(input);
  }

  async enableAPI(input: EnableAPIInput): Promise<APIEnableResult> {
    return this.apiService.enableAPI(input);
  }

  async checkIAMRole(input: { projectId: string; userEmail: string }): Promise<boolean> {
    return this.iamService.checkIAMRole(input);
  }

  async checkAPIEnabled(input: { projectId: string }): Promise<boolean> {
    return this.apiService.checkAPIEnabled(input);
  }

  async testConnectionWithApiKey(input: TestConnectionWithApiKeyInput): Promise<ConnectionTestResult> {
    return this.connectionService.testConnectionWithApiKey(input);
  }

  async testConnection(input: TestConnectionInput): Promise<ConnectionTestResult> {
    return this.connectionService.testConnection(input);
  }
}
