/**
 * Logic tests for UploadHandler.
 * Tests the Chef — business logic, error mapping, success states.
 * Mocks the SDK Project dependency; never calls the real API.
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { UploadHandler } from '../../../src/commands/upload/handler.js';
import type { UploadInput } from '../../../src/commands/upload/spec.js';

// ── Mock factory ───────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<UploadInput> = {}): UploadInput {
  return {
    projectId: 'proj-abc',
    filePath: '/home/user/mockup.png',
    ...overrides,
  };
}

function makeUploadedScreens(count = 1) {
  return Array.from({ length: count }, (_, i) => ({
    screenId: `screen-${i + 1}`,
    projectId: 'proj-abc',
  }));
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('UploadHandler', () => {
  let mockUpload: ReturnType<typeof mock>;

  beforeEach(() => {
    mockUpload = mock(() => Promise.resolve(makeUploadedScreens(1)));
  });

  describe('success path', () => {
    it('returns success with uploaded screen IDs', async () => {
      const handler = new UploadHandler({
        upload: mockUpload,
      });

      const result = await handler.execute(makeInput());

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.screens).toHaveLength(1);
        expect(result.screens[0]!.screenId).toBe('screen-1');
        expect(result.screens[0]!.projectId).toBe('proj-abc');
      }
    });

    it('passes projectId and filePath to upload', async () => {
      const handler = new UploadHandler({ upload: mockUpload });
      await handler.execute(makeInput({ projectId: 'my-proj', filePath: '/path/to/img.png' }));

      expect(mockUpload).toHaveBeenCalledWith('my-proj', '/path/to/img.png', undefined);
    });

    it('passes optional title to upload', async () => {
      const handler = new UploadHandler({ upload: mockUpload });
      await handler.execute(makeInput({ title: 'Home Screen' }));

      expect(mockUpload).toHaveBeenCalledWith('proj-abc', '/home/user/mockup.png', 'Home Screen');
    });

    it('returns all screens when multiple are uploaded', async () => {
      mockUpload = mock(() => Promise.resolve(makeUploadedScreens(3)));
      const handler = new UploadHandler({ upload: mockUpload });

      const result = await handler.execute(makeInput());

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.screens).toHaveLength(3);
      }
    });
  });

  describe('error path', () => {
    it('returns FILE_NOT_FOUND when upload throws ENOENT', async () => {
      const enoentError = Object.assign(new Error('File not found'), { code: 'ENOENT' });
      mockUpload = mock(() => Promise.reject(enoentError));
      const handler = new UploadHandler({ upload: mockUpload });

      const result = await handler.execute(makeInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('FILE_NOT_FOUND');
        expect(result.error.recoverable).toBe(false);
      }
    });

    it('returns UNSUPPORTED_FORMAT when upload throws unsupported format error', async () => {
      mockUpload = mock(() => Promise.reject(new Error('Unsupported file extension ".bmp"')));
      const handler = new UploadHandler({ upload: mockUpload });

      const result = await handler.execute(makeInput({ filePath: '/img.bmp' }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNSUPPORTED_FORMAT');
      }
    });

    it('returns AUTH_FAILED on 401/403 errors', async () => {
      mockUpload = mock(() => Promise.reject(new Error('Request failed with status 401')));
      const handler = new UploadHandler({ upload: mockUpload });

      const result = await handler.execute(makeInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AUTH_FAILED');
        expect(result.error.recoverable).toBe(false);
      }
    });

    it('returns UPLOAD_FAILED on generic upload errors', async () => {
      mockUpload = mock(() => Promise.reject(new Error('Network timeout')));
      const handler = new UploadHandler({ upload: mockUpload });

      const result = await handler.execute(makeInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UPLOAD_FAILED');
        expect(result.error.recoverable).toBe(true);
      }
    });

    it('never throws — always returns a Result', async () => {
      mockUpload = mock(() => Promise.reject('string error (not an Error object)'));
      const handler = new UploadHandler({ upload: mockUpload });

      const result = await handler.execute(makeInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNKNOWN_ERROR');
      }
    });
  });
});
