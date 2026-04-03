import { describe, test, expect, mock } from 'bun:test';

// Mock chalk BEFORE importing the theme
mock.module('chalk', () => {
  const identity = (s: any) => s;
  return {
    blue: identity,
    cyan: identity,
    green: identity,
    red: identity,
    yellow: identity,
    gray: identity,
    bold: identity,
    default: {
      blue: identity,
      cyan: identity,
      green: identity,
      red: identity,
      yellow: identity,
      gray: identity,
      bold: identity,
    },
  };
});

// Now import the theme
import { theme } from './theme.js';

describe('theme', () => {
  test('should have all expected semantic theme properties', () => {
    const expectedKeys = [
      'primary',
      'secondary',
      'success',
      'error',
      'warning',
      'gray',
      'bold',
    ];

    expectedKeys.forEach((key) => {
      expect(theme).toHaveProperty(key);
      const value = (theme as any)[key];
      expect(typeof value).toBe('function');
    });
  });
});
