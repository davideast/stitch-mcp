import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { DoctorHandler } from './handler.js';
import { GcloudHandler } from '../../services/gcloud/handler.js';
import { StitchHandler } from '../../services/stitch/handler.js';

// Mock dotenv to prevent loading .env file
mock.module('dotenv', () => ({
  default: {
    config: mock(() => ({})),
  },
  config: mock(() => ({})),
}));

// Create mocks for the class methods
const mockEnsureInstalled = mock();
const mockAuthenticate = mock();
const mockAuthenticateADC = mock();
const mockListProjects = mock();
const mockGetAccessToken = mock();
const mockTestConnection = mock();
const mockTestConnectionWithApiKey = mock();
const mockGetProjectId = mock();

// Mocks removed as we use DI now

describe('DoctorHandler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset mocks before each test
    process.env = { ...originalEnv };
    delete process.env.STITCH_API_KEY;
    mockEnsureInstalled.mockClear();
    mockAuthenticate.mockClear();
    mockAuthenticateADC.mockClear();
    mockListProjects.mockClear();
    mockGetAccessToken.mockClear();
    mockTestConnection.mockClear();
    mockTestConnectionWithApiKey.mockClear();
    mockGetProjectId.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('execute', () => {
    it('should return all checks passed when services are healthy', async () => {
      // Arrange: Set up successful mock return values
      mockEnsureInstalled.mockResolvedValue({
        success: true,
        data: { location: 'system', version: '450.0.0', path: '/usr/bin/gcloud' },
      });
      mockAuthenticate.mockResolvedValue({
        success: true,
        data: { account: 'test@example.com' },
      });
      mockAuthenticateADC.mockResolvedValue({ success: true });
      mockGetProjectId.mockResolvedValue('test-project');
      mockGetAccessToken.mockResolvedValue('test-token');
      mockTestConnection.mockResolvedValue({
        success: true,
        data: { statusCode: 200 },
      });

      // Mock objects (with just the necessary methods typed as any)
      const mockGcloudService: any = {
        ensureInstalled: mockEnsureInstalled,
        authenticate: mockAuthenticate,
        authenticateADC: mockAuthenticateADC,
        listProjects: mockListProjects,
        getProjectId: mockGetProjectId,
        getAccessToken: mockGetAccessToken,
      };

      const mockStitchService: any = {
        testConnection: mockTestConnection,
        testConnectionWithApiKey: mockTestConnectionWithApiKey,
      };

      // Act
      const handler = new DoctorHandler(mockGcloudService, mockStitchService);
      const result = await handler.execute({ verbose: false });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allPassed).toBe(true);
        expect(result.data.checks.every((c) => c.passed)).toBe(true);
        expect(result.data.checks.length).toBe(5); // Ensure all 5 checks were performed
      }
    });

    it('should return checks failed when gcloud is not installed', async () => {
      // Arrange: Mock gcloud not installed
      mockEnsureInstalled.mockResolvedValue({
        success: false,
        error: { code: 'GCLOUD_NOT_FOUND', message: 'gcloud not found' },
      });

      const mockGcloudService: any = {
        ensureInstalled: mockEnsureInstalled,
        authenticate: mockAuthenticate,
        authenticateADC: mockAuthenticateADC,
        listProjects: mockListProjects,
        getProjectId: mockGetProjectId,
        getAccessToken: mockGetAccessToken,
      };

      const mockStitchService: any = {
        testConnection: mockTestConnection,
        testConnectionWithApiKey: mockTestConnectionWithApiKey,
      };

      // Mock other calls to prevent crash (doctor generally tries to continue)
      mockAuthenticate.mockResolvedValue({ success: false, error: { message: 'Skipped' } });
      mockAuthenticateADC.mockResolvedValue({ success: false, error: { message: 'Skipped' } });
      mockGetProjectId.mockResolvedValue(null);
      mockGetAccessToken.mockResolvedValue(null);

      // Act
      const handler = new DoctorHandler(mockGcloudService, mockStitchService);
      const result = await handler.execute({ verbose: false });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const gcloudCheck = result.data.checks.find((c) => c.name === 'Google Cloud CLI');
        expect(result.data.allPassed).toBe(false);
        expect(gcloudCheck?.passed).toBe(false);
      }
    });
  });

  describe('API key auth mode', () => {
    it('should pass all checks when API key is set and connectivity passes', async () => {
      process.env.STITCH_API_KEY = 'AIzaSyTestKey123';

      mockTestConnectionWithApiKey.mockResolvedValue({
        success: true,
        data: { connected: true, statusCode: 200, url: 'https://stitch.googleapis.com/mcp' },
      });

      const mockGcloudService: any = {
        ensureInstalled: mockEnsureInstalled,
        authenticate: mockAuthenticate,
        authenticateADC: mockAuthenticateADC,
        listProjects: mockListProjects,
        getProjectId: mockGetProjectId,
        getAccessToken: mockGetAccessToken,
      };

      const mockStitchService: any = {
        testConnection: mockTestConnection,
        testConnectionWithApiKey: mockTestConnectionWithApiKey,
      };

      const handler = new DoctorHandler(mockGcloudService, mockStitchService);
      const result = await handler.execute({ verbose: false });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allPassed).toBe(true);
        expect(result.data.checks.length).toBe(2);
        expect(result.data.checks[0].name).toBe('API Key');
        expect(result.data.checks[0].passed).toBe(true);
        expect(result.data.checks[1].name).toBe('Stitch API');
        expect(result.data.checks[1].passed).toBe(true);
      }

      // gcloud mocks should NOT have been called
      expect(mockEnsureInstalled).not.toHaveBeenCalled();
      expect(mockAuthenticate).not.toHaveBeenCalled();
      expect(mockAuthenticateADC).not.toHaveBeenCalled();
      expect(mockGetProjectId).not.toHaveBeenCalled();
    });

    it('should show API Key passed but Stitch API failed on connectivity failure', async () => {
      process.env.STITCH_API_KEY = 'AIzaSyTestKey123';

      mockTestConnectionWithApiKey.mockResolvedValue({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Permission denied',
          suggestion: 'Check that your API key is valid and has access to the Stitch API',
          recoverable: true,
        },
      });

      const mockGcloudService: any = {
        ensureInstalled: mockEnsureInstalled,
        authenticate: mockAuthenticate,
        authenticateADC: mockAuthenticateADC,
        listProjects: mockListProjects,
        getProjectId: mockGetProjectId,
        getAccessToken: mockGetAccessToken,
      };

      const mockStitchService: any = {
        testConnection: mockTestConnection,
        testConnectionWithApiKey: mockTestConnectionWithApiKey,
      };

      const handler = new DoctorHandler(mockGcloudService, mockStitchService);
      const result = await handler.execute({ verbose: false });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allPassed).toBe(false);
        expect(result.data.checks.length).toBe(2);
        expect(result.data.checks[0].name).toBe('API Key');
        expect(result.data.checks[0].passed).toBe(true);
        expect(result.data.checks[1].name).toBe('Stitch API');
        expect(result.data.checks[1].passed).toBe(false);
        expect(result.data.checks[1].suggestion).toContain('API key');
      }
    });

    it('should run gcloud checks when no API key is set (existing behavior)', async () => {
      // No STITCH_API_KEY set

      mockEnsureInstalled.mockResolvedValue({
        success: true,
        data: { location: 'system', version: '450.0.0', path: '/usr/bin/gcloud' },
      });
      mockAuthenticate.mockResolvedValue({
        success: true,
        data: { account: 'test@example.com' },
      });
      mockAuthenticateADC.mockResolvedValue({ success: true });
      mockGetProjectId.mockResolvedValue('test-project');
      mockGetAccessToken.mockResolvedValue('test-token');
      mockTestConnection.mockResolvedValue({
        success: true,
        data: { statusCode: 200 },
      });

      const mockGcloudService: any = {
        ensureInstalled: mockEnsureInstalled,
        authenticate: mockAuthenticate,
        authenticateADC: mockAuthenticateADC,
        listProjects: mockListProjects,
        getProjectId: mockGetProjectId,
        getAccessToken: mockGetAccessToken,
      };

      const mockStitchService: any = {
        testConnection: mockTestConnection,
        testConnectionWithApiKey: mockTestConnectionWithApiKey,
      };

      const handler = new DoctorHandler(mockGcloudService, mockStitchService);
      const result = await handler.execute({ verbose: false });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.checks.length).toBe(5);
        expect(result.data.allPassed).toBe(true);
      }

      // API key method should NOT have been called
      expect(mockTestConnectionWithApiKey).not.toHaveBeenCalled();
    });
  });
});
