import { describe, test } from 'bun:test';
import { AuthModeStep } from '../src/commands/init/steps/AuthModeStep';
import { type InitContext } from '../src/commands/init/context';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'perf_hooks';

describe('AuthModeStep Benchmark', () => {

  test('benchmark run', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stitch-bench-auth-'));
    const oldCwd = process.cwd();
    process.chdir(tempDir);
    const step = new AuthModeStep();
    const context = {
      ui: {
        promptAuthMode: async () => 'apiKey',
        promptApiKeyStorage: async () => '.env',
        promptApiKey: async () => 'test-api-key',
        warn: () => {},
      }
    } as unknown as InitContext;

    const iterations = 5000;

    // We do one dry run to warm up JIT, etc
    await step.run(context);

    // remove files so it doesn't grow huge
    const envPath = path.join(process.cwd(), '.env');
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(envPath)) fs.unlinkSync(envPath);
    if (fs.existsSync(gitignorePath)) fs.unlinkSync(gitignorePath);

    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        // remove files so it doesn't grow huge
        if (fs.existsSync(envPath)) fs.unlinkSync(envPath);
        if (fs.existsSync(gitignorePath)) fs.unlinkSync(gitignorePath);

        await step.run(context);
    }

    const end = performance.now();
    console.log(`\n\nBENCHMARK: Execution time for ${iterations} iterations: ${(end - start).toFixed(2)}ms\n\n`);
    process.chdir(oldCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
