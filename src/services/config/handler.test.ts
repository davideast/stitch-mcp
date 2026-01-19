import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { ConfigHandler, FileSystem } from './handler';
import { GcloudService } from '../gcloud/spec';

describe('ConfigHandler', () => {
  let gcloudMock: GcloudService;
  let fsMock: FileSystem;
  let handler: ConfigHandler;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    delete process.env.STITCH_PROJECT_ID;

    gcloudMock = {
        getProjectId: mock(() => Promise.resolve(null)),
    } as unknown as GcloudService;

    fsMock = {
      existsSync: mock(() => false),
      readFileSync: mock(() => ''),
    };

    handler = new ConfigHandler(gcloudMock, fsMock);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return env source when STITCH_PROJECT_ID is set', async () => {
    process.env.STITCH_PROJECT_ID = 'env-project';

    const result = await handler.resolveContext();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectId).toBe('env-project');
      expect(result.data.source).toBe('env');
    }

    // Ensure others are not called (not strictly necessary but good for verification of short-circuit)
    expect(fsMock.existsSync).not.toHaveBeenCalled();
    expect(gcloudMock.getProjectId).not.toHaveBeenCalled();
  });

  it('should return package.json source when STITCH_PROJECT_ID is unset and package.json has stitch.projectId', async () => {
    fsMock.existsSync = mock((path: string) => path.endsWith('package.json'));
    fsMock.readFileSync = mock(() => JSON.stringify({ stitch: { projectId: 'pkg-project' } }));

    const result = await handler.resolveContext();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectId).toBe('pkg-project');
      expect(result.data.source).toBe('package.json');
    }

    expect(fsMock.existsSync).toHaveBeenCalled();
    expect(gcloudMock.getProjectId).not.toHaveBeenCalled();
  });

  it('should return gcloud source when others are unset and gcloud returns project', async () => {
    gcloudMock.getProjectId = mock(() => Promise.resolve('gcloud-project'));

    const result = await handler.resolveContext();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectId).toBe('gcloud-project');
      expect(result.data.source).toBe('gcloud');
    }

    expect(fsMock.existsSync).toHaveBeenCalled(); // Checked package.json first
    expect(gcloudMock.getProjectId).toHaveBeenCalled();
  });

  it('should return MISSING_PROJECT_ID when all fail', async () => {
    // defaults are already set to fail

    const result = await handler.resolveContext();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('MISSING_PROJECT_ID');
    }
  });

  it('should handle invalid package.json gracefully and fall through', async () => {
    fsMock.existsSync = mock(() => true);
    fsMock.readFileSync = mock(() => 'invalid json');
    gcloudMock.getProjectId = mock(() => Promise.resolve('fallback-project'));

    const result = await handler.resolveContext();

    expect(result.success).toBe(true);
    if (result.success) {
        expect(result.data.source).toBe('gcloud');
        expect(result.data.projectId).toBe('fallback-project');
    }
  });
});
