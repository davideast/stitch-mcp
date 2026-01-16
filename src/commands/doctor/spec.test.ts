import { describe, it, expect } from 'bun:test';
import { DoctorInputSchema } from './spec.js';

describe('DoctorCommand', () => {
  describe('DoctorInputSchema', () => {
    it('should pass with valid input', () => {
      const input = {
        verbose: true,
      };
      const result = DoctorInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should set verbose and staging to false by default', () => {
      const input = {};
      const result = DoctorInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.verbose).toBe(false);
        expect(result.data.staging).toBe(false);
      }
    });

    it('should fail with invalid input type for staging', () => {
      const input = {
        staging: 'true',
      };
      const result = DoctorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should fail with invalid input type for verbose', () => {
      const input = {
        verbose: 'true',
      };
      const result = DoctorInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
