import { describe, test, expect, beforeEach } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BlobRef, BlobStoreSpec, GetResult, HasResult, PutResult } from '../blob-store/spec.js';
import type { AppendResult } from '../append.js';
import type { AppendFn, Event } from './spec.js';
import { CaptureHandler } from './handler.js';

// --- in-memory test doubles -------------------------------------------------

class FakeBlobs implements BlobStoreSpec {
  store = new Map<string, Buffer>(); // sha → bytes
  putCount = 0;
  fetchCount = 0;
  /** url → response. If the response has `.fail`, fetch returns failure. */
  urls = new Map<string, { mime?: string; body?: Buffer; fail?: { code: 'BLOB_FETCH_HTTP_ERROR' | 'BLOB_FETCH_NETWORK'; status?: number } }>();

  async put(buffer: Buffer, mime: string): Promise<PutResult> {
    this.putCount++;
    const sha = await sha256(buffer);
    this.store.set(sha, buffer);
    return { success: true, data: { sha256: sha, size: buffer.length, mime } };
  }
  async fetch(url: string, mimeHint?: string): Promise<PutResult> {
    this.fetchCount++;
    const r = this.urls.get(url);
    if (!r) return { success: false, error: { code: 'BLOB_FETCH_HTTP_ERROR', message: `no mock for ${url}`, recoverable: false } };
    if (r.fail) return { success: false, error: { code: r.fail.code, message: `mocked ${r.fail.status ?? ''}`, recoverable: false } };
    const buf = r.body ?? Buffer.from('');
    return this.put(buf, r.mime ?? mimeHint ?? 'application/octet-stream');
  }
  async has(sha256: string): Promise<HasResult> { return { success: true, data: this.store.has(sha256) }; }
  async get(sha256: string): Promise<GetResult> { return { success: true, data: this.store.get(sha256) ?? null }; }
}

async function sha256(buf: Buffer): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(buf).digest('hex');
}

function makeAppend(): { fn: AppendFn; events: Event[] } {
  const events: Event[] = [];
  const fn: AppendFn = async (e) => { events.push(e); return { success: true } as AppendResult; };
  return { fn, events };
}

const PROBE = '.stitch-mcp/log-probe';
async function probe(name: string): Promise<{ result: any; duration_ms: number }> {
  const raw = JSON.parse(await readFile(join(PROBE, name), 'utf8'));
  return { result: raw.result, duration_ms: raw.duration_ms };
}

// reusable counter-based newId
function makeIdGen() {
  let i = 0; return () => `id${i++}`;
}

let blobs: FakeBlobs;
let appendCtl: ReturnType<typeof makeAppend>;
let h: CaptureHandler;

beforeEach(() => {
  blobs = new FakeBlobs();
  appendCtl = makeAppend();
  h = new CaptureHandler({ blobs, append: appendCtl.fn, newId: makeIdGen() });
});

// --- 1) generate_screen_from_text -------------------------------------------

describe('generate_screen_from_text', () => {
  test('writes call.requested + call.completed; produces 1 screen with all blobs filled', async () => {
    const { result, duration_ms } = await probe('3-generate-screen.json');
    // mock the asset URLs that the screen references
    const sc = result.structuredContent;
    const screen = sc.outputComponents.find((c: any) => c.design)?.design.screens[0];
    blobs.urls.set(screen.htmlCode.downloadUrl, { mime: 'text/html', body: Buffer.from('<html>real</html>') });
    blobs.urls.set(screen.screenshot.downloadUrl, { mime: 'image/png', body: Buffer.from('PNG-bytes') });

    const r = await h.capture({
      tool: 'generate_screen_from_text',
      args: { projectId: '7240244230308968338', prompt: 'A minimal landing page for a typography-focused blog. One headline, one paragraph, one CTA.' },
      result, duration_ms, started_at: '2026-04-25T18:07:47Z', finished_at: '2026-04-25T18:09:12Z',
    });

    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.produced_screen_ids).toEqual(['871df1dad8e54bb0ad9a3322ceee6260']);
    expect(r.data.warnings).toEqual([]);

    expect(appendCtl.events.map((e) => e.type)).toEqual(['call.requested', 'call.completed']);

    const completed = appendCtl.events[1]!;
    expect(completed.payload).toMatchObject({ tool: 'generate_screen_from_text', kind: 'generative' });
    if (completed.type !== 'call.completed' || completed.payload.kind !== 'generative') throw new Error();
    expect(completed.payload.stitch_session_id).toBe('6904021969822429940');
    expect(completed.payload.produced_screens).toHaveLength(1);

    const ps = completed.payload.produced_screens[0]!;
    expect(ps.screen_id).toBe('871df1dad8e54bb0ad9a3322ceee6260');
    expect(ps.parent_screen_id).toBeNull();
    expect(ps.sibling_screen_ids).toEqual([]);
    expect(ps.effective_prompt.startsWith('A minimal landing page for a typography-focused blog.')).toBe(true);
    expect(ps.html_blob).not.toBeNull();
    expect(ps.screenshot_blob).not.toBeNull();
    expect(ps.theme_blob).not.toBeNull();
    expect(ps.design_system_blob).not.toBeNull();
  });

  test('effective_prompt comes from screen.prompt, NOT args.prompt', async () => {
    const { result, duration_ms } = await probe('3-generate-screen.json');
    const sc = result.structuredContent;
    const screen = sc.outputComponents.find((c: any) => c.design)?.design.screens[0];
    blobs.urls.set(screen.htmlCode.downloadUrl, { mime: 'text/html', body: Buffer.from('<html/>') });
    blobs.urls.set(screen.screenshot.downloadUrl, { mime: 'image/png', body: Buffer.from('png') });

    const userInput = 'Short prompt';   // deliberately different from screen.prompt
    await h.capture({
      tool: 'generate_screen_from_text',
      args: { projectId: '7240244230308968338', prompt: userInput },
      result, duration_ms, started_at: 't0', finished_at: 't1',
    });

    const requested = appendCtl.events[0]!;
    if (requested.type !== 'call.requested') throw new Error();
    expect(requested.payload.user_prompt).toBe(userInput);

    const completed = appendCtl.events[1]!;
    if (completed.type !== 'call.completed' || completed.payload.kind !== 'generative') throw new Error();
    const ep = completed.payload.produced_screens[0]!.effective_prompt;
    expect(ep).not.toBe(userInput);
    expect(ep.length).toBeGreaterThan(userInput.length);
  });
});

// --- 2) generate_variants ----------------------------------------------------

describe('generate_variants', () => {
  test('produces N screens with shared parent and sibling cross-refs', async () => {
    const { result, duration_ms } = await probe('4-generate-variants.json');
    const screens = result.structuredContent.outputComponents.find((c: any) => c.design)?.design.screens;
    for (const s of screens) {
      blobs.urls.set(s.htmlCode.downloadUrl, { mime: 'text/html', body: Buffer.from('<v/>') });
      blobs.urls.set(s.screenshot.downloadUrl, { mime: 'image/png', body: Buffer.from('vpng') });
    }

    const parentId = '871df1dad8e54bb0ad9a3322ceee6260';
    const r = await h.capture({
      tool: 'generate_variants',
      args: {
        projectId: '7240244230308968338', selectedScreenIds: [parentId],
        prompt: 'Vary it', variantOptions: { variantCount: 2, creativeRange: 'EXPLORE', aspects: ['COLOR_SCHEME', 'LAYOUT'] },
      },
      result, duration_ms, started_at: 't0', finished_at: 't1',
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.produced_screen_ids).toHaveLength(2);

    const completed = appendCtl.events[1]!;
    if (completed.type !== 'call.completed' || completed.payload.kind !== 'generative') throw new Error();

    for (const ps of completed.payload.produced_screens) {
      expect(ps.parent_screen_id).toBe(parentId);
      expect(ps.sibling_screen_ids).toHaveLength(1);
      const otherId = completed.payload.produced_screens.find((p) => p.screen_id !== ps.screen_id)!.screen_id;
      expect(ps.sibling_screen_ids).toEqual([otherId]);
      // variants come back with empty theme → theme_blob null is expected
      expect(ps.theme_blob).toBeNull();
    }
  });
});

// --- 3) edit_screens ---------------------------------------------------------

describe('edit_screens', () => {
  test('produces 1 child screen with parent set and theme/designSystem captured', async () => {
    const { result, duration_ms } = await probe('5-edit-screens.json');
    const screen = result.structuredContent.outputComponents.find((c: any) => c.design)?.design.screens[0];
    blobs.urls.set(screen.htmlCode.downloadUrl, { mime: 'text/html', body: Buffer.from('<edit/>') });
    blobs.urls.set(screen.screenshot.downloadUrl, { mime: 'image/png', body: Buffer.from('epng') });

    const parentId = '871df1dad8e54bb0ad9a3322ceee6260';
    const r = await h.capture({
      tool: 'edit_screens',
      args: { projectId: '7240244230308968338', selectedScreenIds: [parentId], prompt: 'Make it bigger' },
      result, duration_ms, started_at: 't0', finished_at: 't1',
    });
    expect(r.success).toBe(true);
    const completed = appendCtl.events[1]!;
    if (completed.type !== 'call.completed' || completed.payload.kind !== 'generative') throw new Error();
    expect(completed.payload.produced_screens).toHaveLength(1);
    const ps = completed.payload.produced_screens[0]!;
    expect(ps.parent_screen_id).toBe(parentId);
    expect(ps.sibling_screen_ids).toEqual([]);
    expect(ps.theme_blob).not.toBeNull();   // edit returns full theme
  });
});

// --- 4) read calls -----------------------------------------------------------

describe('read calls', () => {
  test('get_screen logs read summary with project_id+screen_ids; NO blob fetches', async () => {
    const { result, duration_ms } = await probe('6-get-screen.json');
    const r = await h.capture({
      tool: 'get_screen',
      args: { projectId: '7240244230308968338', screenId: '871df1dad8e54bb0ad9a3322ceee6260' },
      result, duration_ms, started_at: 't0', finished_at: 't1',
    });
    expect(r.success).toBe(true);
    expect(blobs.fetchCount).toBe(0);          // no eager downloads on read

    const completed = appendCtl.events[1]!;
    if (completed.type !== 'call.completed' || completed.payload.kind !== 'read') throw new Error();
    expect(completed.payload.project_id).toBe('7240244230308968338');
    expect(completed.payload.screen_ids).toEqual(['871df1dad8e54bb0ad9a3322ceee6260']);
  });

  test('list_projects logs as read; structured response is NOT blobbed', async () => {
    const { result, duration_ms } = await probe('1-list-projects.json');
    const beforePuts = blobs.putCount;
    const r = await h.capture({
      tool: 'list_projects', args: {}, result, duration_ms, started_at: 't0', finished_at: 't1',
    });
    expect(r.success).toBe(true);
    // Only the args_blob should have been put (the response body is huge for list_projects)
    expect(blobs.putCount - beforePuts).toBe(1);
    expect(blobs.fetchCount).toBe(0);

    const completed = appendCtl.events[1]!;
    if (completed.type !== 'call.completed' || completed.payload.kind !== 'read') throw new Error();
    expect(completed.payload.tool).toBe('list_projects');
  });
});

// --- 5) failures ------------------------------------------------------------

describe('failures', () => {
  test('explicit isError → call.failed with error_text', async () => {
    const { result, duration_ms } = await probe('8-fail-bogus-screen.json');
    const r = await h.capture({
      tool: 'get_screen',
      args: { projectId: '0', screenId: 'doesnotexist' },
      result, duration_ms, started_at: 't0', finished_at: 't1',
    });
    expect(r.success).toBe(true);
    expect(appendCtl.events.map((e) => e.type)).toEqual(['call.requested', 'call.failed']);
    const failed = appendCtl.events[1]!;
    if (failed.type !== 'call.failed') throw new Error();
    expect(failed.payload.is_error).toBe(true);
    expect(failed.payload.error_text).toContain('not found');
  });

  test('zero produced screens on a generative call → call.failed with is_error="empty"', async () => {
    const { result, duration_ms } = await probe('9-fail-missing-required.json');
    const r = await h.capture({
      tool: 'edit_screens',
      args: { projectId: '7240244230308968338' }, // missing selectedScreenIds + prompt — server returns no-op
      result, duration_ms, started_at: 't0', finished_at: 't1',
    });
    expect(r.success).toBe(true);
    const failed = appendCtl.events[1]!;
    if (failed.type !== 'call.failed') throw new Error();
    expect(failed.payload.is_error).toBe('empty');
  });
});

// --- 6) robustness ----------------------------------------------------------

describe('robustness', () => {
  test('a single failed asset fetch does NOT abort capture; warning recorded', async () => {
    const { result, duration_ms } = await probe('3-generate-screen.json');
    const sc = result.structuredContent;
    const screen = sc.outputComponents.find((c: any) => c.design)?.design.screens[0];
    // HTML succeeds, screenshot URL is mocked to FAIL
    blobs.urls.set(screen.htmlCode.downloadUrl, { mime: 'text/html', body: Buffer.from('<html/>') });
    blobs.urls.set(screen.screenshot.downloadUrl, { fail: { code: 'BLOB_FETCH_HTTP_ERROR', status: 410 } });

    const r = await h.capture({
      tool: 'generate_screen_from_text',
      args: { projectId: '7240244230308968338', prompt: 'p' },
      result, duration_ms, started_at: 't0', finished_at: 't1',
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.produced_screen_ids).toHaveLength(1);
    expect(r.data.warnings.length).toBeGreaterThanOrEqual(1);
    expect(r.data.warnings[0]).toContain('screenshot');

    const completed = appendCtl.events[1]!;
    if (completed.type !== 'call.completed' || completed.payload.kind !== 'generative') throw new Error();
    const ps = completed.payload.produced_screens[0]!;
    expect(ps.html_blob).not.toBeNull();
    expect(ps.screenshot_blob).toBeNull();        // failed; null preserved
  });

  test('unknown tool returns CAPTURE_UNKNOWN_TOOL', async () => {
    const r = await h.capture({
      tool: 'nope', args: {}, result: {}, duration_ms: 0, started_at: 't', finished_at: 't',
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('CAPTURE_UNKNOWN_TOOL');
  });
});
