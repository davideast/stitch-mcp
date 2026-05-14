import { readFile } from 'node:fs/promises';
import type { CommandStep, StepResult } from '../../../framework/CommandStep.js';
import type { ToolContext } from '../context.js';

export class ParseArgsStep implements CommandStep<ToolContext> {
  id = 'parse-args';
  name = 'Parse tool arguments';

  async shouldRun(context: ToolContext): Promise<boolean> {
    return !!context.input.toolName
      && context.input.toolName !== 'list'
      && !context.input.showSchema;
  }

  async run(context: ToolContext): Promise<StepResult> {
    let args: Record<string, any> = {};

    if (context.input.data) {
      args = JSON.parse(context.input.data);
    } else if (context.input.dataFile) {
      const content = await readFile(context.input.dataFile.replace('@', ''), 'utf-8');
      args = JSON.parse(content);
    }

    context.parsedArgs = args;
    return { success: true };
  }
}
