import { test, expect, describe } from 'bun:test';
import { getServeHandler, endsWith, contains } from './registry.js';

describe('serve registry', () => {
  test('returns handler for .htmlCode path', () => {
    expect(getServeHandler('screen.htmlCode')).not.toBeNull();
  });

  test('returns handler for .htmlCode.downloadUrl path', () => {
    expect(getServeHandler('screen.htmlCode.downloadUrl')).not.toBeNull();
  });

  test('returns null for unregistered paths', () => {
    expect(getServeHandler('screen.title')).toBeNull();
  });
});

describe('path matchers', () => {
  test('endsWith matches suffix', () => {
    const matcher = endsWith('.htmlCode');
    expect(matcher('screen.htmlCode')).toBe(true);
    expect(matcher('screen.htmlCode.downloadUrl')).toBe(false);
  });

  test('contains matches segment', () => {
    const matcher = contains('htmlCode');
    expect(matcher('screen.htmlCode')).toBe(true);
    expect(matcher('screen.title')).toBe(false);
  });
});
