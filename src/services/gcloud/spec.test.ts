import { describe, test, expect } from 'bun:test';
import { EnsureGcloudInputSchema } from './spec';

describe('EnsureGcloudInputSchema', () => {
  test('should accept valid input with defaults', () => {
    const input = {};
    const result = EnsureGcloudInputSchema.parse(input);
    expect(result.minVersion).toBe('400.0.0');
    expect(result.forceLocal).toBe(false);
    expect(result.useSystemGcloud).toBeFalsy();
  });

  test('should accept useSystemGcloud=true', () => {
    const input = { useSystemGcloud: true };
    const result = EnsureGcloudInputSchema.parse(input);
    expect(result.useSystemGcloud).toBe(true);
  });

  test('should accept useSystemGcloud=false', () => {
    const input = { useSystemGcloud: false };
    const result = EnsureGcloudInputSchema.parse(input);
    expect(result.useSystemGcloud).toBe(false);
  });
});
