import ora, { type Ora } from 'ora';
import { theme, icons } from './theme.js';

/**
 * Wrapper for ora spinner with consistent styling
 */
export class Spinner {
  private spinner: Ora | null = null;

  start(message: string): void {
    this.spinner = ora({
      text: message,
      color: 'blue',
      spinner: 'dots',
    }).start();
  }

  succeed(message: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    }
  }

  fail(message: string): void {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }
}

export function createSpinner(): Spinner {
  return new Spinner();
}
