import { type InitCommand, type InitInput, type InitResult } from './spec.js';
import { GcloudHandler } from '../../services/gcloud/handler.js';
import { type GcloudService } from '../../services/gcloud/spec.js';
import { ProjectHandler } from '../../services/project/handler.js';
import { type ProjectService } from '../../services/project/spec.js';
import { StitchHandler } from '../../services/stitch/handler.js';
import { type StitchService } from '../../services/stitch/spec.js';
import { McpConfigHandler } from '../../services/mcp-config/handler.js';
import { type McpConfigService } from '../../services/mcp-config/spec.js';
import { ChecklistUIHandler } from '../../ui/checklist/handler.js';
import { theme } from '../../ui/theme.js';
import { ConsoleUI } from '../../framework/ConsoleUI.js';
import { type InitContext } from './context.js';
import { type CommandStep } from '../../framework/CommandStep.js';
import { type ChecklistItemStateType } from '../../ui/checklist/spec.js';
import { runSteps } from '../../framework/StepRunner.js';

import { ClientSelectionStep } from './steps/ClientSelectionStep.js';
import { AuthModeStep } from './steps/AuthModeStep.js';
import { GcloudInstallStep } from './steps/GcloudInstallStep.js';
import { AuthStep } from './steps/AuthStep.js';
import { TransportStep } from './steps/TransportStep.js';
import { ProjectSelectStep } from './steps/ProjectSelectStep.js';
import { IamApiStep } from './steps/IamApiStep.js';
import { ConfigStep } from './steps/ConfigStep.js';
import { TestConnectionStep } from './steps/TestConnectionStep.js';

export class InitHandler implements InitCommand {
  private readonly gcloudService: GcloudService;
  private readonly mcpConfigService: McpConfigService;
  private readonly projectService: ProjectService;
  private readonly stitchService: StitchService;
  private checklist: ChecklistUIHandler;
  private steps: CommandStep<InitContext>[];

  constructor(
    gcloudService?: GcloudService,
    mcpConfigService?: McpConfigService,
    projectService?: ProjectService,
    stitchService?: StitchService
  ) {
    this.gcloudService = gcloudService || new GcloudHandler();
    this.mcpConfigService = mcpConfigService || new McpConfigHandler();
    this.projectService = projectService || new ProjectHandler(this.gcloudService);
    this.stitchService = stitchService || new StitchHandler();
    this.checklist = new ChecklistUIHandler();

    this.steps = [
      new ClientSelectionStep(),
      new AuthModeStep(),
      new GcloudInstallStep(),
      new AuthStep(),
      new TransportStep(),
      new ProjectSelectStep(),
      new IamApiStep(),
      new ConfigStep(),
      new TestConnectionStep(),
    ];
  }

  async execute(input: InitInput): Promise<InitResult> {
    // Initialize Checklist
    this.checklist.initialize({
      title: 'Stitch MCP Setup',
      items: this.steps.map(s => ({ id: s.id, label: s.name })),
      showProgress: true,
      animationDelayMs: 100,
    });

    console.log(`\n${theme.blue('🧵 Stitch MCP Setup')}\n`);

    const context: InitContext = {
      input,
      ui: new ConsoleUI(),
      gcloudService: this.gcloudService,
      mcpConfigService: this.mcpConfigService,
      projectService: this.projectService,
      stitchService: this.stitchService,
    };

    try {
      const { stoppedAt } = await runSteps(this.steps, context, {
        onBeforeStep: (step) => this.updateStep(step.id, 'IN_PROGRESS'),
        onAfterStep: (step, result) => {
          if (!result.success) {
            const message = result.error?.message || result.detail || 'Failed';
            this.updateStep(step.id, 'FAILED', message);
            return true; // stop on failure
          }
          const status = (result.status as ChecklistItemStateType) || 'COMPLETE';
          this.updateStep(step.id, status, result.detail, result.reason);
          return false;
        },
        onSkippedStep: (step) => this.updateStep(step.id, 'SKIPPED', 'Not required'),
      });

      if (stoppedAt) {
        const message = stoppedAt.result.error?.message || stoppedAt.result.detail || 'Failed';
        return {
          success: false,
          error: {
            code: (stoppedAt.result.errorCode as any) || 'UNKNOWN_ERROR',
            message,
            recoverable: true,
          },
        };
      }

      // Final Summary
      const { percent } = this.checklist.getProgress();
      const barWidth = 40;
      const filled = Math.round((percent / 100) * barWidth);
      const bar = '━'.repeat(filled) + '─'.repeat(barWidth - filled);
      console.log(`\n  ${bar} ${percent}%`);

      if (this.checklist.isComplete()) {
        console.log(`\n${theme.green('🎉 Setup complete!')}\n`);
      }

      if (context.instructions) {
          console.log(context.instructions);
      }

      return {
        success: true,
        data: {
          projectId: context.projectId || 'ignored',
          mcpConfig: context.finalConfig || '',
          instructions: context.instructions || '',
        },
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    }
  }

  private updateStep(
    stepId: string,
    state: ChecklistItemStateType,
    detail?: string,
    reason?: string
  ): void {
    this.checklist.updateItem({ itemId: stepId, state, detail, reason });
    if (state !== 'IN_PROGRESS') {
      const step = this.steps.find(s => s.id === stepId);
      this.printStepResult(stepId, step?.name || stepId, state, detail, reason);
    }
  }

  private printStepResult(
    stepId: string,
    label: string,
    state: ChecklistItemStateType,
    detail?: string,
    reason?: string
  ): void {
    // Find index for step number
    const stepIndex = this.steps.findIndex(s => s.id === stepId);
    const stepNum = stepIndex + 1;

    const icons: Record<ChecklistItemStateType, string> = {
      PENDING: '○',
      IN_PROGRESS: '▸',
      COMPLETE: '✓',
      SKIPPED: '−',
      FAILED: '✗',
    };
    const icon = icons[state];

    const colors: Record<ChecklistItemStateType, (s: string) => string> = {
      PENDING: theme.gray,
      IN_PROGRESS: theme.yellow,
      COMPLETE: theme.green,
      SKIPPED: theme.gray,
      FAILED: theme.red,
    };
    const color = colors[state];

    let line = `  ${color(icon)}  ${stepNum}. ${label}`;
    if (detail) {
      line += ` ${theme.gray('·')} ${detail}`;
    }
    console.log(line);

    if (reason) {
      console.log(`     └─ ${theme.gray(reason)}`);
    }
  }
}
