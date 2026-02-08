import { describe, it, expect, afterEach } from 'bun:test';
import { ProjectSyncer } from './ProjectSyncer.js';

// Minimal stub — fetchContent only uses global fetch, not the client
const stubClient = {} as any;

describe('ProjectSyncer.fetchContent', () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  });

  function mockInstantTimers() {
    globalThis.setTimeout = ((fn: Function) => { fn(); return 0; }) as any;
  }

  it('returns text on 200', async () => {
    globalThis.fetch = async () => new Response('hello', { status: 200 });
    const syncer = new ProjectSyncer(stubClient);
    const result = await syncer.fetchContent('https://example.com');
    expect(result).toBe('hello');
  });

  it('throws on non-429 error without retrying', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return new Response(null, { status: 500, statusText: 'Internal Server Error' });
    };
    const syncer = new ProjectSyncer(stubClient);
    await expect(syncer.fetchContent('https://example.com')).rejects.toThrow('Failed to fetch content: Internal Server Error');
    expect(callCount).toBe(1);
  });

  it('does not retry 403 errors', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return new Response(null, { status: 403, statusText: 'Forbidden' });
    };
    const syncer = new ProjectSyncer(stubClient);
    await expect(syncer.fetchContent('https://example.com')).rejects.toThrow('Forbidden');
    expect(callCount).toBe(1);
  });

  it('retries on 429 and succeeds when next attempt is OK', async () => {
    mockInstantTimers();
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(null, { status: 429, statusText: 'Too Many Requests' });
      }
      return new Response('recovered', { status: 200 });
    };
    const syncer = new ProjectSyncer(stubClient);
    const result = await syncer.fetchContent('https://example.com');
    expect(result).toBe('recovered');
    expect(callCount).toBe(2);
  });

  it('retries multiple consecutive 429s before succeeding', async () => {
    mockInstantTimers();
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount <= 3) {
        return new Response(null, { status: 429, statusText: 'Too Many Requests' });
      }
      return new Response('ok', { status: 200 });
    };
    const syncer = new ProjectSyncer(stubClient);
    const result = await syncer.fetchContent('https://example.com');
    expect(result).toBe('ok');
    expect(callCount).toBe(4);
  });

  it('throws after exhausting all retries on persistent 429', async () => {
    mockInstantTimers();
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return new Response(null, { status: 429, statusText: 'Too Many Requests' });
    };
    const syncer = new ProjectSyncer(stubClient);
    await expect(syncer.fetchContent('https://example.com')).rejects.toThrow('Failed to fetch content: Too Many Requests');
    // 1 initial + 4 retries = 5 total attempts
    expect(callCount).toBe(5);
  });

  it('applies exponential backoff delays between retries', async () => {
    const delays: number[] = [];
    globalThis.setTimeout = ((fn: Function, ms: number) => {
      delays.push(ms);
      fn();
      return 0;
    }) as any;

    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount <= 3) {
        return new Response(null, { status: 429, statusText: 'Too Many Requests' });
      }
      return new Response('ok', { status: 200 });
    };

    const syncer = new ProjectSyncer(stubClient);
    await syncer.fetchContent('https://example.com');

    // 3 retries → 3 backoff delays: 1000, 2000, 4000
    expect(delays).toEqual([1000, 2000, 4000]);
  });

  it('caps backoff delay at 8000ms', async () => {
    const delays: number[] = [];
    globalThis.setTimeout = ((fn: Function, ms: number) => {
      delays.push(ms);
      fn();
      return 0;
    }) as any;

    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount <= 4) {
        return new Response(null, { status: 429, statusText: 'Too Many Requests' });
      }
      return new Response('ok', { status: 200 });
    };

    const syncer = new ProjectSyncer(stubClient);
    await syncer.fetchContent('https://example.com');

    // 4 retries → delays: 1000, 2000, 4000, 8000
    expect(delays).toEqual([1000, 2000, 4000, 8000]);
  });
});
