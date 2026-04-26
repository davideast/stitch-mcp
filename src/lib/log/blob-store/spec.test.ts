import { describe, test, expect } from 'bun:test';
import {
  BlobRefSchema,
  BlobStoreErrorSchema,
  Sha256Schema,
  PutResultSchema,
  GetResultSchema,
  HasResultSchema,
} from './spec.js';

describe('Sha256Schema', () => {
  const validShas = [
    'a'.repeat(64),
    '0123456789abcdef'.repeat(4),
  ];
  for (const v of validShas) {
    test(`accepts valid sha (len=${v.length})`, () => {
      expect(Sha256Schema.safeParse(v).success).toBe(true);
    });
  }

  const invalidCases: { val: unknown; reason: string }[] = [
    { val: '', reason: 'empty' },
    { val: 'A'.repeat(64), reason: 'uppercase rejected' },
    { val: 'g'.repeat(64), reason: 'non-hex char' },
    { val: 'a'.repeat(63), reason: 'too short' },
    { val: 'a'.repeat(65), reason: 'too long' },
    { val: 12345, reason: 'not a string' },
  ];
  for (const c of invalidCases) {
    test(`rejects ${c.reason}`, () => {
      expect(Sha256Schema.safeParse(c.val).success).toBe(false);
    });
  }
});

describe('BlobRefSchema', () => {
  test('accepts a well-formed ref', () => {
    const r = BlobRefSchema.safeParse({ sha256: 'a'.repeat(64), size: 0, mime: 'application/json' });
    expect(r.success).toBe(true);
  });

  test('rejects negative size', () => {
    const r = BlobRefSchema.safeParse({ sha256: 'a'.repeat(64), size: -1, mime: 'text/html' });
    expect(r.success).toBe(false);
  });

  test('rejects empty mime', () => {
    const r = BlobRefSchema.safeParse({ sha256: 'a'.repeat(64), size: 1, mime: '' });
    expect(r.success).toBe(false);
  });
});

describe('BlobStoreErrorSchema', () => {
  test('accepts a known error code', () => {
    const r = BlobStoreErrorSchema.safeParse({ code: 'BLOB_WRITE_FAILED', message: 'disk full', recoverable: false });
    expect(r.success).toBe(true);
  });

  test('rejects unknown error code', () => {
    const r = BlobStoreErrorSchema.safeParse({ code: 'NOPE', message: 'x', recoverable: true });
    expect(r.success).toBe(false);
  });
});

describe('Result discriminated unions', () => {
  test('PutResult: success branch parses', () => {
    const r = PutResultSchema.safeParse({
      success: true,
      data: { sha256: 'a'.repeat(64), size: 10, mime: 'image/png' },
    });
    expect(r.success).toBe(true);
  });

  test('PutResult: failure branch parses', () => {
    const r = PutResultSchema.safeParse({
      success: false,
      error: { code: 'BLOB_FETCH_HTTP_ERROR', message: '404', recoverable: false },
    });
    expect(r.success).toBe(true);
  });

  test('GetResult: data null is valid (absent)', () => {
    const r = GetResultSchema.safeParse({ success: true, data: null });
    expect(r.success).toBe(true);
  });

  test('HasResult: data must be boolean', () => {
    const ok = HasResultSchema.safeParse({ success: true, data: true });
    expect(ok.success).toBe(true);
    const bad = HasResultSchema.safeParse({ success: true, data: 'yes' });
    expect(bad.success).toBe(false);
  });
});
