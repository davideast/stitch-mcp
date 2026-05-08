/**
 * Contract tests for UploadImageInputSchema.
 * Tests the Bouncer — invalid data must be rejected before reaching the handler.
 */
import { describe, it, expect } from 'bun:test';
// @ts-expect-error - Verification of the new capability naming contract before implementation (TDD RED)
import { UploadInputSchema } from '../../../src/commands/upload/spec.js';

describe('UploadInputSchema', () => {
  describe('projectId', () => {
    it('rejects empty projectId', () => {
      const result = UploadInputSchema.safeParse({ projectId: '', filePath: '/img.png' });
      expect(result.success).toBe(false);
    });

    it('rejects missing projectId', () => {
      const result = UploadInputSchema.safeParse({ filePath: '/img.png' });
      expect(result.success).toBe(false);
    });
  });

  describe('filePath', () => {
    it('rejects empty filePath', () => {
      const result = UploadInputSchema.safeParse({ projectId: 'proj-1', filePath: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing filePath', () => {
      const result = UploadInputSchema.safeParse({ projectId: 'proj-1' });
      expect(result.success).toBe(false);
    });

    it('rejects path traversal attempts', () => {
      const result = UploadInputSchema.safeParse({ projectId: 'proj-1', filePath: '../secret.png' });
      expect(result.success).toBe(false);
    });
  });

  describe('valid input', () => {
    it('accepts valid projectId and filePath', () => {
      const result = UploadInputSchema.safeParse({ projectId: 'proj-1', filePath: '/home/user/mockup.png' });
      expect(result.success).toBe(true);
    });

    it('accepts optional title', () => {
      const result = UploadInputSchema.safeParse({ projectId: 'proj-1', filePath: '/img.png', title: 'Home Screen' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Home Screen');
      }
    });

    it('title defaults to undefined when not provided', () => {
      const result = UploadInputSchema.safeParse({ projectId: 'proj-1', filePath: '/img.png' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBeUndefined();
      }
    });
  });
});
