import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { AdcProjectCheckStep } from './AdcProjectCheckStep.js';
import { type DoctorContext } from '../context.js';

const mockReadFile = mock(() => Promise.resolve(''));
mock.module('node:fs', () => ({
  default: {
    promises: {
      readFile: mockReadFile,
    },
  },
}));

mock.module('../../../platform/detector.js', () => ({
  getGcloudConfigPath: () => '/mock/.stitch-mcp/config',
}));

mock.module('../../../platform/paths.js', () => ({
  joinPath: (...parts: string[]) => parts.join('/'),
}));

function createMockContext(overrides?: Partial<DoctorContext>): DoctorContext {
  return {
    input: { verbose: false, json: false },
    ui: { log: () => {}, warn: () => {}, error: () => {}, promptConfirm: async () => true } as any,
    gcloudService: {
      getProjectId: async () => 'test-project-123',
    } as any,
    stitchService: {} as any,
    authMode: 'oauth',
    checks: [],
    ...overrides,
  };
}

describe('AdcProjectCheckStep', () => {
  let step: AdcProjectCheckStep;

  beforeEach(() => {
    step = new AdcProjectCheckStep();
    mockReadFile.mockReset();
  });

  it('should only run in oauth mode', async () => {
    expect(await step.shouldRun(createMockContext({ authMode: 'oauth' }))).toBe(true);
    expect(await step.shouldRun(createMockContext({ authMode: 'apiKey' }))).toBe(false);
  });

  it('passes when quota_project_id is present', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      type: 'authorized_user',
      quota_project_id: 'my-project',
    }));

    const ctx = createMockContext();
    const result = await step.run(ctx);

    expect(result.success).toBe(true);
    expect(ctx.checks[0].passed).toBe(true);
    expect(ctx.checks[0].message).toContain('my-project');
  });

  it('fails when quota_project_id is missing', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      type: 'authorized_user',
    }));

    const ctx = createMockContext();
    const result = await step.run(ctx);

    expect(result.success).toBe(false);
    expect(ctx.checks[0].passed).toBe(false);
    expect(ctx.checks[0].suggestion).toContain('set-quota-project');
    expect(ctx.checks[0].suggestion).toContain('test-project-123');
  });

  it('skips gracefully when ADC file does not exist', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    const ctx = createMockContext();
    const result = await step.run(ctx);

    expect(result.success).toBe(true);
    expect(result.status).toBe('SKIPPED');
  });
});
