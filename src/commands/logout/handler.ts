import { type LogoutCommand, type LogoutInput, type LogoutResult } from './spec.js';
import { GcloudHandler } from '../../services/gcloud/handler.js';
import { type GcloudService } from '../../services/gcloud/spec.js';
import { theme } from '../../ui/theme.js';
import { ConsoleUI } from '../../framework/ConsoleUI.js';
import { type LogoutContext } from './context.js';
import { type CommandStep } from '../../framework/CommandStep.js';

import { PrepareStep } from './steps/PrepareStep.js';
import { RevokeUserStep } from './steps/RevokeUserStep.js';
import { RevokeAdcStep } from './steps/RevokeAdcStep.js';
import { ClearConfigStep } from './steps/ClearConfigStep.js';

export class LogoutHandler implements LogoutCommand {
  private steps: CommandStep<LogoutContext>[];

  constructor(private readonly gcloudService: GcloudService = new GcloudHandler()) {
    this.steps = [
      new PrepareStep(),
      new RevokeUserStep(),
      new RevokeAdcStep(),
      new ClearConfigStep(),
    ];
  }

  async execute(input: LogoutInput): Promise<LogoutResult> {
    const context: LogoutContext = {
      input,
      ui: new ConsoleUI(),
      gcloudService: this.gcloudService,
      userRevoked: false,
      adcRevoked: false,
      configCleared: false,
    };

    console.log(`\n${theme.blue('Logout from Google Cloud')}\n`);

    try {
      for (const step of this.steps) {
        if (await step.shouldRun(context)) {
          const result = await step.run(context);

          if (!result.success) {
            if (result.errorCode === 'GCLOUD_NOT_FOUND') {
                return {
                    success: false,
                    error: {
                        code: 'GCLOUD_NOT_FOUND',
                        message: result.error?.message || 'Gcloud not found',
                        recoverable: true
                    }
                };
            }
          }

          if (result.shouldExit) {
              return {
                  success: true,
                  data: {
                      userRevoked: context.userRevoked,
                      adcRevoked: context.adcRevoked,
                      configCleared: context.configCleared,
                  }
              };
          }
        }
      }

      console.log(`\n${theme.green('Successfully logged out!')}\n`);
      console.log(theme.gray('To log back in, run:'));
      console.log(theme.cyan('  stitch-mcp init\n'));

      return {
        success: true,
        data: {
          userRevoked: context.userRevoked,
          adcRevoked: context.adcRevoked,
          configCleared: context.configCleared,
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
}
