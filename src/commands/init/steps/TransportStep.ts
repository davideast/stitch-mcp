import { type CommandStep, type StepResult } from '../../../framework/CommandStep.js';
import { type InitContext } from '../context.js';

export class TransportStep implements CommandStep<InitContext> {
  id = 'connection-method';
  name = 'Choose connection method';

  async shouldRun(context: InitContext): Promise<boolean> {
    return true;
  }

  async run(context: InitContext): Promise<StepResult> {
    if (context.input.transport) {
      context.transport = this.resolveTransport(context.input.transport);
      const transportLabel = context.transport === 'http' ? 'Direct' : 'Proxy';
      return {
        success: true,
        detail: transportLabel,
        status: 'SKIPPED',
        reason: 'Set via --transport flag'
      };
    }

    context.transport = await context.ui.promptTransportType(context.authMode);
    const transportLabel = context.transport === 'http' ? 'Direct' : 'Proxy';
    return {
      success: true,
      detail: transportLabel
    };
  }

  private resolveTransport(input: string): 'http' | 'stdio' {
    const normalized = input.trim().toLowerCase();
    if (normalized === 'http') return 'http';
    if (normalized === 'stdio') return 'stdio';
    throw new Error(`Invalid transport '${input}'. Supported: http, stdio`);
  }
}
