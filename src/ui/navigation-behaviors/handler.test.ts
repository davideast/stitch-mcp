/**
 * Tests for navigation behaviors.
 */
import { test, expect, describe } from 'bun:test';
import {
  screenInstanceNavigationHandler,
  getNavigationTarget,
  registerNavigationHandler,
  type NavigationContext,
} from './handler.js';

describe('screenInstanceNavigationHandler', () => {
  test('returns shouldNavigate: false for non-screenInstances paths', () => {
    const ctx: NavigationContext = {
      path: 'projects.0.title',
      value: 'My Project',
      key: 'title',
    };

    const result = screenInstanceNavigationHandler(ctx);

    expect(result.shouldNavigate).toBe(false);
  });

  test('navigates when value has sourceScreen property', () => {
    const ctx: NavigationContext = {
      path: 'projects.0.screenInstances.0',
      value: {
        sourceScreen: 'projects/123/screens/abc',
        x: 100,
        y: 200,
      },
      key: '0',
    };

    const result = screenInstanceNavigationHandler(ctx);

    expect(result.shouldNavigate).toBe(true);
    expect(result.target).toBe('projects/123/screens/abc');
    expect(result.type).toBe('screen');
  });

  test('navigates when on sourceScreen property directly', () => {
    const ctx: NavigationContext = {
      path: 'projects.0.screenInstances.0.sourceScreen',
      value: 'projects/456/screens/def',
      key: 'sourceScreen',
    };

    const result = screenInstanceNavigationHandler(ctx);

    expect(result.shouldNavigate).toBe(true);
    expect(result.target).toBe('projects/456/screens/def');
    expect(result.type).toBe('screen');
  });

  test('does not navigate if sourceScreen is not a string', () => {
    const ctx: NavigationContext = {
      path: 'projects.0.screenInstances.0.sourceScreen',
      value: { nested: 'object' },
      key: 'sourceScreen',
    };

    const result = screenInstanceNavigationHandler(ctx);

    expect(result.shouldNavigate).toBe(false);
  });

  test('does not navigate for screenInstances without sourceScreen', () => {
    const ctx: NavigationContext = {
      path: 'projects.0.screenInstances.0.x',
      value: 100,
      key: 'x',
    };

    const result = screenInstanceNavigationHandler(ctx);

    expect(result.shouldNavigate).toBe(false);
  });
});

describe('getNavigationTarget', () => {
  test('returns first matching handler result', () => {
    const ctx: NavigationContext = {
      path: 'projects.0.screenInstances.5',
      value: { sourceScreen: 'projects/999/screens/xyz' },
      key: '5',
    };

    const result = getNavigationTarget(ctx);

    expect(result.shouldNavigate).toBe(true);
    expect(result.target).toBe('projects/999/screens/xyz');
  });

  test('returns shouldNavigate: false when no handler matches', () => {
    const ctx: NavigationContext = {
      path: 'some.random.path',
      value: 'random value',
      key: 'path',
    };

    const result = getNavigationTarget(ctx);

    expect(result.shouldNavigate).toBe(false);
  });
});

describe('registerNavigationHandler', () => {
  test('custom handlers take priority', () => {
    // Register a custom handler for testing
    registerNavigationHandler((ctx) => {
      if (ctx.path.includes('.customNav.')) {
        return {
          shouldNavigate: true,
          target: 'custom-target',
          type: 'custom',
        };
      }
      return { shouldNavigate: false };
    });

    const ctx: NavigationContext = {
      path: 'projects.0.customNav.item',
      value: 'test',
      key: 'item',
    };

    const result = getNavigationTarget(ctx);

    expect(result.shouldNavigate).toBe(true);
    expect(result.target).toBe('custom-target');
    expect(result.type).toBe('custom');
  });
});
