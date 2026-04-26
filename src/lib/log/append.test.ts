import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendEvent } from './append.js';

let root: string;
let path: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'append-'));
  path = join(root, 'events.jsonl');
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const validEvent = {
  id: '01abc',
  time: '2026-04-25T18:00:00Z',
  trace_id: '01trace',
  schema_version: 1 as const,
  type: 'call.requested',
  payload: { tool: 'list_projects' },
};

describe('appendEvent', () => {
  test('writes exactly one line ending in newline', async () => {
    const r = await appendEvent(path, validEvent);
    expect(r.success).toBe(true);

    const content = await readFile(path, 'utf8');
    expect(content.endsWith('\n')).toBe(true);
    const lines = content.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({ id: '01abc', type: 'call.requested' });
  });

  test('appends successive events on separate lines', async () => {
    await appendEvent(path, validEvent);
    await appendEvent(path, { ...validEvent, id: '01def', type: 'call.completed' });
    const content = await readFile(path, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1]!).type).toBe('call.completed');
  });

  test('returns EVENT_VALIDATION_FAILED on bad envelope', async () => {
    const r = await appendEvent(path, { ...validEvent, schema_version: 2 });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('EVENT_VALIDATION_FAILED');
  });

  test('returns EVENT_VALIDATION_FAILED when type is missing', async () => {
    const { type: _t, ...without } = validEvent;
    const r = await appendEvent(path, without);
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('EVENT_VALIDATION_FAILED');
  });

  test('returns EVENT_WRITE_FAILED when destination cannot be written', async () => {
    const r = await appendEvent('/proc/cannot-write-here/x.jsonl', validEvent);
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.code).toBe('EVENT_WRITE_FAILED');
  });

  test('30 concurrent appends produce 30 well-formed lines (line atomicity)', async () => {
    const events = Array.from({ length: 30 }, (_, i) => ({ ...validEvent, id: `e${i}` }));
    await Promise.all(events.map((e) => appendEvent(path, e)));
    const content = await readFile(path, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    expect(lines).toHaveLength(30);
    for (const l of lines) expect(() => JSON.parse(l)).not.toThrow();
  });
});
