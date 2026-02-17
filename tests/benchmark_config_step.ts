import { describe, test, spyOn, beforeAll, afterAll } from 'bun:test';
import { ConfigStep } from '../src/commands/init/steps/ConfigStep';
import { type InitContext } from '../src/commands/init/context';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'perf_hooks';
import * as shell from '../src/platform/shell';
import * as spinner from '../src/ui/spinner';

describe('ConfigStep Benchmark', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stitch-bench-'));
  const stitchExtensionDir = path.join(tempDir, '.gemini', 'extensions', 'Stitch');
  const extensionPath = path.join(stitchExtensionDir, 'gemini-extension.json');

  const mockSpinnerObj = { start: () => {}, stop: () => {}, succeed: () => {}, fail: () => {}, text: '' };

  beforeAll(() => {
    // Mock dependencies using spyOn
    spyOn(shell, 'execCommand').mockResolvedValue({ success: true } as any);
    spyOn(spinner, 'createSpinner').mockReturnValue(mockSpinnerObj as any);
    spyOn(os, 'homedir').mockReturnValue(tempDir);

    // Setup filesystem
    fs.mkdirSync(stitchExtensionDir, { recursive: true });
    const initialConfig = {
      mcpServers: {
        stitch: {
          command: 'old',
          args: [],
          env: {}
        }
      }
    };
    fs.writeFileSync(extensionPath, JSON.stringify(initialConfig));
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('benchmark run', async () => {
    const step = new ConfigStep();
    const context = {
      ui: {
        log: () => {},
        prompt: async () => '',
        promptSecret: async () => '',
        promptConfirm: async () => false,
        promptSelect: async () => '',
        promptMultiSelect: async () => [],
        createSpinner: () => mockSpinnerObj,
      },
      mcpConfigService: {
        generateConfig: async () => ({
          success: true,
          data: { instructions: 'instr', config: 'conf' }
        }),
      },
      mcpClient: 'gemini-cli',
      transport: 'stdio',
      projectId: 'test-project',
      apiKey: 'test-api-key',
      authMode: 'apiKey',
    } as unknown as InitContext;

    const iterations = 500; // Increased iterations for better resolution
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
        await step.run(context);
    }

    const end = performance.now();
    console.log(`\n\nBENCHMARK: Execution time for ${iterations} iterations: ${(end - start).toFixed(2)}ms\n\n`);
  });
});
