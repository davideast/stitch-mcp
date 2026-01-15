import { $ } from 'bun';

export interface ShellResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

/**
 * Execute a shell command and return the result
 */
export async function execCommand(command: string[], options?: { cwd?: string; env?: Record<string, string> }): Promise<ShellResult> {
  try {
    const proc = $`${command}`.cwd(options?.cwd || process.cwd()).env(options?.env || {}).quiet().nothrow();

    const result = await proc;

    return {
      success: result.exitCode === 0,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
      exitCode: result.exitCode,
    };
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute a shell command and stream output
 */
export async function execCommandStreaming(
  command: string[],
  onStdout?: (data: string) => void,
  onStderr?: (data: string) => void,
  options?: { cwd?: string; env?: Record<string, string> }
): Promise<ShellResult> {
  try {
    const proc = $`${command}`.cwd(options?.cwd || process.cwd()).env(options?.env || {});

    const result = await proc;

    const stdout = result.stdout.toString();
    const stderr = result.stderr.toString();

    if (onStdout && stdout) {
      onStdout(stdout);
    }

    if (onStderr && stderr) {
      onStderr(stderr);
    }

    return {
      success: result.exitCode === 0,
      stdout,
      stderr,
      exitCode: result.exitCode,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (onStderr) {
      onStderr(errorMsg);
    }

    return {
      success: false,
      stdout: '',
      stderr: errorMsg,
      exitCode: 1,
      error: errorMsg,
    };
  }
}

/**
 * Check if a command exists in PATH
 */
export async function commandExists(command: string): Promise<boolean> {
  const result = await execCommand(process.platform === 'win32' ? ['where', command] : ['which', command]);
  return result.success;
}
