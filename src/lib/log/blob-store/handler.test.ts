import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { BlobStoreHandler } from './handler.js';
import { BlobRefSchema } from './spec.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'blob-store-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('put()', () => {
  test('is idempotent — same content does not write twice', async () => {
    const store = new BlobStoreHandler(root);
    const buf = Buffer.from('hello');

    const r1 = await store.put(buf, 'text/plain');
    expect(r1.success).toBe(true);
    if (!r1.success) return;
    const path = join(root, r1.data.sha256.slice(0, 2), `${r1.data.sha256}.bin`);
    const mtime1 = (await stat(path)).mtimeMs;

    // wait a tick so a re-write would have a different mtime
    await new Promise((res) => setTimeout(res, 10));

    const r2 = await store.put(buf, 'text/plain');
    expect(r2.success).toBe(true);
    if (!r2.success) return;
    expect(r2.data.sha256).toBe(r1.data.sha256);

    const mtime2 = (await stat(path)).mtimeMs;
    expect(mtime2).toBe(mtime1); // not re-written
  });
});

describe('has() / get()', () => {
  test('has() reflects whether a sha is present', async () => {
    const store = new BlobStoreHandler(root);
    const buf = Buffer.from('payload');
    const put = await store.put(buf, 'application/json');
    expect(put.success).toBe(true);
    if (!put.success) return;

    const present = await store.has(put.data.sha256);
    expect(present.success).toBe(true);
    if (!present.success) return;
    expect(present.data).toBe(true);

    const absent = await store.has('0'.repeat(64));
    expect(absent.success).toBe(true);
    if (!absent.success) return;
    expect(absent.data).toBe(false);
  });

  test('get() round-trips bytes; null when absent', async () => {
    const store = new BlobStoreHandler(root);
    const buf = Buffer.from([1, 2, 3, 4, 5]);
    const put = await store.put(buf, 'application/json');
    expect(put.success).toBe(true);
    if (!put.success) return;

    const present = await store.get(put.data.sha256);
    expect(present.success).toBe(true);
    if (!present.success) return;
    expect(present.data).not.toBeNull();
    expect(Buffer.compare(present.data!, buf)).toBe(0);

    const absent = await store.get('0'.repeat(64));
    expect(absent.success).toBe(true);
    if (!absent.success) return;
    expect(absent.data).toBeNull();
  });
});

describe('put() — error mapping', () => {
  test('returns Failure(BLOB_WRITE_FAILED) when the root path is not writable', async () => {
    // Use a path that contains a non-directory ancestor (a regular file). mkdir will EEXIST/ENOTDIR.
    const buf = Buffer.from('x');
    const fakeFile = join(root, 'this-is-a-file');
    await Bun.write(fakeFile, 'sentinel');
    const store = new BlobStoreHandler(join(fakeFile, 'cannot-be-a-dir'));

    const r = await store.put(buf, 'application/json');
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('BLOB_WRITE_FAILED');
    expect(r.error.message).toBeDefined();
  });
});

describe('fetch()', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  test('downloads bytes and stores them as a blob', async () => {
    const html = Buffer.from('<!doctype html><h1>hi</h1>');
    let capturedUrl: string | undefined;
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (input: any, init?: any) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }) as any;

    const store = new BlobStoreHandler(root);
    const r = await store.fetch('https://example.com/page');
    expect(r.success).toBe(true);
    if (!r.success) return;

    expect(r.data.mime).toBe('text/html');
    expect(r.data.size).toBe(html.length);
    expect(capturedUrl).toBe('https://example.com/page');
    expect((capturedInit as any)?.redirect).toBe('follow');

    // round-trip via get()
    const got = await store.get(r.data.sha256);
    expect(got.success).toBe(true);
    if (!got.success) return;
    expect(Buffer.compare(got.data!, html)).toBe(0);
  });

  test('returns Failure(BLOB_FETCH_HTTP_ERROR) on non-2xx', async () => {
    globalThis.fetch = (async () => new Response('nope', { status: 404 })) as any;
    const store = new BlobStoreHandler(root);
    const r = await store.fetch('https://example.com/missing');
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('BLOB_FETCH_HTTP_ERROR');
    expect(r.error.message).toContain('404');
  });

  test('returns Failure(BLOB_FETCH_NETWORK) when fetch throws', async () => {
    globalThis.fetch = (async () => { throw new TypeError('connection refused'); }) as any;
    const store = new BlobStoreHandler(root);
    const r = await store.fetch('https://example.com/down');
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('BLOB_FETCH_NETWORK');
    expect(r.error.recoverable).toBe(true);
  });
});

describe('put() — extra cases', () => {
  test('writes one file under <sha[:2]>/<sha>.<ext> and returns a valid BlobRef', async () => {
    const store = new BlobStoreHandler(root);
    const buf = Buffer.from(JSON.stringify({ hello: 'world' }));
    const expectedSha = createHash('sha256').update(buf).digest('hex');

    const result = await store.put(buf, 'application/json');

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(BlobRefSchema.safeParse(result.data).success).toBe(true);
    expect(result.data.sha256).toBe(expectedSha);
    expect(result.data.size).toBe(buf.length);
    expect(result.data.mime).toBe('application/json');

    const expectedPath = join(root, expectedSha.slice(0, 2), `${expectedSha}.json`);
    const s = await stat(expectedPath);
    expect(s.isFile()).toBe(true);
    expect(s.size).toBe(buf.length);
  });
});
