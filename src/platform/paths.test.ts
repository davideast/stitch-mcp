import { describe, test, expect } from 'bun:test';
import path from 'node:path';
import {
  joinPath,
  dirname,
  basename,
  normalizePath,
  toUnixPath,
} from './paths';

describe('platform/paths', () => {
  describe('joinPath', () => {
    test('joins path segments', () => {
      const parts = ['a', 'b', 'c'];
      const expected = path.join(...parts);
      expect(joinPath(...parts)).toBe(expected);
    });

    test('joins path segments with separator', () => {
      const parts = ['a', 'b/c'];
      const expected = path.join(...parts);
      expect(joinPath(...parts)).toBe(expected);
    });
  });

  describe('dirname', () => {
    test('returns directory name', () => {
      const filepath = path.join('a', 'b', 'c.txt');
      const expected = path.dirname(filepath);
      expect(dirname(filepath)).toBe(expected);
    });

    test('returns dot for empty path', () => {
      expect(dirname('')).toBe('.');
    });
  });

  describe('basename', () => {
    test('returns basename', () => {
      const filepath = path.join('a', 'b', 'c.txt');
      const expected = path.basename(filepath);
      expect(basename(filepath)).toBe(expected);
    });

    test('returns basename with extension', () => {
      const filepath = path.join('a', 'b', 'c.txt');
      expect(basename(filepath)).toBe('c.txt');
    });
  });

  describe('normalizePath', () => {
    test('normalizes path', () => {
      const filepath = path.join('a', '..', 'b', 'c');
      const expected = path.normalize(filepath);
      expect(normalizePath(filepath)).toBe(expected);
    });
  });

  describe('toUnixPath', () => {
    test('converts path separators to forward slashes', () => {
      // Create a path that would have system separators
      const parts = ['a', 'b', 'c'];
      // Manually construct a path with system separators
      const systemPath = parts.join(path.sep);

      const expected = parts.join('/');
      expect(toUnixPath(systemPath)).toBe(expected);
    });

    test('handles mixed separators correctly', () => {
      // This test ensures that if we have mixed separators, they are all converted
      const mixed = `a${path.sep}b/c`;
      // If path.sep is /, it's a/b/c -> a/b/c
      // If path.sep is \, it's a\b/c -> a/b/c

      const expected = 'a/b/c';
      expect(toUnixPath(mixed)).toBe(expected);
    });

    test('preserves forward slashes', () => {
        const input = 'a/b/c';
        expect(toUnixPath(input)).toBe('a/b/c');
    });
  });
});
