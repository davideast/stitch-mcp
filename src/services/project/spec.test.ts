import { describe, it, expect } from 'bun:test';
import {
  SelectProjectInputSchema,
  ProjectSelectionSuccess,
  ProjectSelectionFailure,
} from './spec.js';

describe('Project Service Contracts', () => {
  describe('SelectProjectInputSchema', () => {
    it('should validate a valid input', () => {
      const input = {
        allowSearch: true,
        limit: 10,
      };
      const result = SelectProjectInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should use default values', () => {
      const input = {};
      const result = SelectProjectInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          allowSearch: true,
          limit: 5,
        });
      }
    });

    it('should invalidate an invalid input', () => {
      const input = {
        allowSearch: 'true',
        limit: '10',
      };
      const result = SelectProjectInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('ProjectSelectionResult', () => {
    it('should validate a success result', () => {
      const result = {
        success: true,
        data: {
          projectId: 'my-project',
          name: 'My Project',
        },
      };
      const validation = ProjectSelectionSuccess.safeParse(result);
      expect(validation.success).toBe(true);
    });

    it('should validate a failure result', () => {
      const result = {
        success: false,
        error: {
          code: 'NO_PROJECTS_FOUND',
          message: 'No projects found',
          recoverable: false,
        },
      };
      const validation = ProjectSelectionFailure.safeParse(result);
      expect(validation.success).toBe(true);
    });

    it('should invalidate an invalid success result', () => {
      const result = {
        success: true,
        data: {
          projectId: 123,
        },
      };
      const validation = ProjectSelectionSuccess.safeParse(result);
      expect(validation.success).toBe(false);
    });

    it('should invalidate an invalid failure result', () => {
      const result = {
        success: false,
        error: {
          code: 'INVALID_CODE',
          message: 'An error occurred',
        },
      };
      const validation = ProjectSelectionFailure.safeParse(result);
      expect(validation.success).toBe(false);
    });
  });
});
