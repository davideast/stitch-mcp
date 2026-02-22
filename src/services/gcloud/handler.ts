import {
  type GcloudService,
  type EnsureGcloudInput,
  type AuthenticateInput,
  type ListProjectsInput,
  type SetProjectInput,
  type GcloudResult,
  type AuthResult,
  type ProjectListResult,
  type ProjectSetResult,
} from './spec.js';
import { GcloudExecutor } from './core.js';
import { GcloudInstallService } from './install.js';
import { GcloudAuthService } from './auth.js';
import { GcloudProjectService } from './projects.js';

export class GcloudHandler implements GcloudService {
  public executor: GcloudExecutor;
  private installService: GcloudInstallService;
  private authService: GcloudAuthService;
  private projectService: GcloudProjectService;

  constructor() {
    this.executor = new GcloudExecutor();
    this.installService = new GcloudInstallService(this.executor);
    this.authService = new GcloudAuthService(this.executor);
    this.projectService = new GcloudProjectService(this.executor);
  }

  /**
   * Ensure gcloud is installed and available
   */
  async ensureInstalled(input: EnsureGcloudInput): Promise<GcloudResult> {
    return this.installService.ensureInstalled(input);
  }

  /**
   * Authenticate user
   */
  async authenticate(input: AuthenticateInput): Promise<AuthResult> {
    return this.authService.authenticate(input);
  }

  /**
   * Authenticate application default credentials
   */
  async authenticateADC(input: AuthenticateInput): Promise<AuthResult> {
    return this.authService.authenticateADC(input);
  }

  /**
   * List projects
   */
  async listProjects(input: ListProjectsInput): Promise<ProjectListResult> {
    return this.projectService.listProjects(input);
  }

  /**
   * Set active project
   */
  async setProject(input: SetProjectInput): Promise<ProjectSetResult> {
    return this.projectService.setProject(input);
  }

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string | null> {
    return this.authService.getAccessToken();
  }

  async getProjectId(): Promise<string | null> {
    return this.projectService.getProjectId();
  }

  /**
   * Install beta components
   */
  async installBetaComponents(): Promise<{ success: boolean; error?: { message: string } }> {
    return this.installService.installBetaComponents();
  }

  async getActiveAccount(): Promise<string | null> {
    return this.authService.getActiveAccount();
  }

  async hasADC(): Promise<boolean> {
    return this.authService.hasADC();
  }
}
