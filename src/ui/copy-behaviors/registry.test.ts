/**
 * Tests for copy behavior registry.
 */
import { test, expect, describe, beforeEach } from 'bun:test';
import { getHandler, registerHandler, endsWith, contains, defaultCopyHandler } from './registry.js';
import type { CopyHandler, CopyContext, CopyResult } from './types.js';

describe('registry', () => {
  describe('getHandler()', () => {
    test('returns default handler for unregistered paths', () => {
      const handler = getHandler('some.random.path');
      expect(handler).toBe(defaultCopyHandler);
    });

    test('returns registered handler for matching path', () => {
      const handler = getHandler('projects.0.thumbnailScreenshot.downloadUrl');
      // Should match the imageUrlCopyHandler registered in registry.ts
      expect(handler).not.toBe(defaultCopyHandler);
    });

    test('returns image handler for screenshot.downloadUrl', () => {
      const handler = getHandler('screen.screenshot.downloadUrl');
      expect(handler).not.toBe(defaultCopyHandler);
    });

    test('returns html handler for htmlCode.downloadUrl', () => {
      const handler = getHandler('screen.htmlCode.downloadUrl');
      expect(handler).not.toBe(defaultCopyHandler);
    });
  });

  describe('endsWith()', () => {
    test('matches paths ending with suffix', () => {
      const matcher = endsWith('.downloadUrl');

      expect(matcher('projects.0.thumbnailScreenshot.downloadUrl')).toBe(true);
      expect(matcher('foo.bar.downloadUrl')).toBe(true);
      expect(matcher('x.downloadUrl')).toBe(true);
    });

    test('does not match paths not ending with suffix', () => {
      const matcher = endsWith('.downloadUrl');

      expect(matcher('projects.0.thumbnailScreenshot.name')).toBe(false);
      expect(matcher('downloadUrl.extra')).toBe(false);
    });
  });

  describe('contains()', () => {
    test('matches paths containing segment', () => {
      const matcher = contains('thumbnailScreenshot');

      expect(matcher('projects.0.thumbnailScreenshot.downloadUrl')).toBe(true);
      expect(matcher('thumbnailScreenshot')).toBe(true);
      expect(matcher('foo.thumbnailScreenshot.bar')).toBe(true);
    });

    test('does not match paths without segment', () => {
      const matcher = contains('thumbnailScreenshot');

      expect(matcher('projects.0.name')).toBe(false);
      expect(matcher('')).toBe(false);
    });
  });

  describe('registerHandler()', () => {
    test('later registrations take precedence', () => {
      const customHandler: CopyHandler = {
        copy: async () => ({ success: true, message: 'custom' }),
        copyExtended: async () => ({ success: true, message: 'custom extended' }),
      };

      // Register for a specific test path
      registerHandler(endsWith('.testField'), customHandler);

      const handler = getHandler('some.path.testField');
      expect(handler).toBe(customHandler);
    });
  });
});
