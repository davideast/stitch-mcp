import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

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
export async function execCommand(command: string[], options?: { cwd?: string; env?: Record<string, string>; timeout?: number }): Promise<ShellResult> {
  const cmd = command[0];
  if (!cmd) throw new Error('Command cannot be empty');
  const args = command.slice(1);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const spawnOptions: SpawnOptions = {
      cwd: options?.cwd || process.cwd(),
      env: { ...process.env, ...(options?.env || {}) },
      stdio: 'pipe',
      timeout: options?.timeout,
      shell: process.platform === 'win32'
    };

    const child = spawn(cmd, args, spawnOptions) as ChildProcess;

    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    }

    child.on('error', (err: Error) => {
      resolve({
        success: false,
        stdout,
        stderr,
        exitCode: 1,
        error: err.message
      });
    });

    child.on('close', (code: number | null) => {
      resolve({
        success: (code === 0),
        stdout,
        stderr,
        exitCode: code ?? 1
      });
    });
  });
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
  const cmd = command[0];
  if (!cmd) throw new Error('Command cannot be empty');
  const args = command.slice(1);

  return new Promise((resolve) => {
    let stdoutFull = '';
    let stderrFull = '';

    const spawnOptions: SpawnOptions = {
      cwd: options?.cwd || process.cwd(),
      env: { ...process.env, ...(options?.env || {}) },
      stdio: 'pipe',
      shell: process.platform === 'win32'
    };

    const child = spawn(cmd, args, spawnOptions) as ChildProcess;

    if (child.stdout) {
      child.stdout.on('data', (buffer: Buffer) => {
        const str = buffer.toString();
        stdoutFull += str;
        if (onStdout) onStdout(str);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (buffer: Buffer) => {
        const str = buffer.toString();
        stderrFull += str;
        if (onStderr) onStderr(str);
      });
    }

    child.on('error', (err: Error) => {
      const msg = err.message;
      if (onStderr) onStderr(msg);
      resolve({
        success: false,
        stdout: stdoutFull,
        stderr: stderrFull,
        exitCode: 1,
        error: msg
      });
    });

    child.on('close', (code: number | null) => {
      resolve({
        success: (code === 0),
        stdout: stdoutFull,
        stderr: stderrFull,
        exitCode: code ?? 1
      });
    });
  });
}

/**
 * Check if a command exists in PATH
 */
export async function commandExists(command: string): Promise<boolean> {
  const result = await execCommand(process.platform === 'win32' ? ['where', command] : ['which', command]);
  return result.success;
}
