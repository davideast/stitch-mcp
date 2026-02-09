import * as childProcess from 'node:child_process';
import type { ChildProcess, SpawnOptions } from 'node:child_process';

export interface ShellResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

export function getSpawnArgs(command: string, args: string[]) {
  if (process.platform === 'win32') {
    return {
      cmd: 'cmd.exe',
      args: ['/d', '/s', '/c', command, ...args]
    };
  }
  return { cmd: command, args };
}

/**
 * Execute a shell command and return the result
 */
export async function execCommand(command: string[], options?: { cwd?: string; env?: Record<string, string>; timeout?: number }): Promise<ShellResult> {
  const cmd = command[0];
  if (!cmd) throw new Error('Command cannot be empty');
  const args = command.slice(1);

  return new Promise((resolve) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const spawnOptions: SpawnOptions = {
      cwd: options?.cwd || process.cwd(),
      env: { ...process.env, ...(options?.env || {}) },
      stdio: 'pipe',
      timeout: options?.timeout,
      shell: false
    };

    const { cmd: spawnCmd, args: spawnArgs } = getSpawnArgs(cmd, args);
    const child = childProcess.spawn(spawnCmd, spawnArgs, spawnOptions) as ChildProcess;

    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        stdoutChunks.push(data);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        stderrChunks.push(data);
      });
    }

    child.on('error', (err: Error) => {
      resolve({
        success: false,
        stdout: Buffer.concat(stdoutChunks).toString(),
        stderr: Buffer.concat(stderrChunks).toString(),
        exitCode: 1,
        error: err.message
      });
    });

    child.on('close', (code: number | null) => {
      resolve({
        success: (code === 0),
        stdout: Buffer.concat(stdoutChunks).toString(),
        stderr: Buffer.concat(stderrChunks).toString(),
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
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const spawnOptions: SpawnOptions = {
      cwd: options?.cwd || process.cwd(),
      env: { ...process.env, ...(options?.env || {}) },
      stdio: 'pipe',
      shell: false
    };

    const { cmd: spawnCmd, args: spawnArgs } = getSpawnArgs(cmd, args);
    const child = childProcess.spawn(spawnCmd, spawnArgs, spawnOptions) as ChildProcess;

    if (child.stdout) {
      child.stdout.on('data', (buffer: Buffer) => {
        stdoutChunks.push(buffer);
        if (onStdout) onStdout(buffer.toString());
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (buffer: Buffer) => {
        stderrChunks.push(buffer);
        if (onStderr) onStderr(buffer.toString());
      });
    }

    child.on('error', (err: Error) => {
      const msg = err.message;
      if (onStderr) onStderr(msg);
      resolve({
        success: false,
        stdout: Buffer.concat(stdoutChunks).toString(),
        stderr: Buffer.concat(stderrChunks).toString(),
        exitCode: 1,
        error: msg
      });
    });

    child.on('close', (code: number | null) => {
      resolve({
        success: (code === 0),
        stdout: Buffer.concat(stdoutChunks).toString(),
        stderr: Buffer.concat(stderrChunks).toString(),
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
