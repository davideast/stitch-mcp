import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { DoctorHandler } from './handler.js';
import { GcloudHandler } from '../../services/gcloud/handler.js';
import { StitchHandler } from '../../services/stitch/handler.js';

// Create mocks for the class methods
const mockEnsureInstalled = mock();
const mockAuthenticate = mock();
const mockAuthenticateADC = mock();
const mockListProjects = mock();
const mockGetAccessToken = mock();
const mockTestConnection = mock();
const mockGetProjectId = mock();

// Mocks removed as we use DI now

describe('DoctorHandler', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockEnsureInstalled.mockClear();
    mockAuthenticate.mockClear();
    mockAuthenticateADC.mockClear();
    mockListProjects.mockClear();
    mockGetAccessToken.mockClear();
    mockTestConnection.mockClear();
    mockGetProjectId.mockClear();
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

      const mockStitchService: any = {};

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
});
