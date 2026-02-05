import { describe, it, expect, mock, afterEach, beforeEach, spyOn } from 'bun:test';
import fs from 'fs-extra';
import { AssetGateway } from '../../../src/lib/server/AssetGateway';

const originalFetch = global.fetch;
const fetchMock = mock();

// We will spy on methods in beforeEach to ensure fresh start
// and restore in afterEach
let ensureDirSyncSpy: any;
let pathExistsSpy: any;
let readJsonSpy: any;
let createReadStreamSpy: any;
let createWriteStreamSpy: any;
let writeFileSpy: any;
let writeJsonSpy: any;

describe('AssetGateway', () => {
  const root = '/tmp/test-project';

  beforeEach(() => {
    global.fetch = fetchMock;

    ensureDirSyncSpy = spyOn(fs, 'ensureDirSync').mockImplementation(() => undefined);
    pathExistsSpy = spyOn(fs, 'pathExists');
    readJsonSpy = spyOn(fs, 'readJson');
    createReadStreamSpy = spyOn(fs, 'createReadStream').mockReturnValue('stream-result' as any);
    createWriteStreamSpy = spyOn(fs, 'createWriteStream').mockReturnValue({} as any);
    writeFileSpy = spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    writeJsonSpy = spyOn(fs, 'writeJson').mockResolvedValue(undefined);
    fetchMock.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mock.restore();
  });

  it('fetches and caches remote assets on miss', async () => {
    const gateway = new AssetGateway(root);

    // Setup
    pathExistsSpy.mockResolvedValue(false); // Cache Miss
    fetchMock.mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => Buffer.from('fake-image-data'),
      body: true
    });
    createReadStreamSpy.mockReturnValue('stream-result');

    const result = await gateway.fetchAsset('http://remote.com/img.png');

    expect(fetchMock).toHaveBeenCalled();
    expect(writeFileSpy).toHaveBeenCalled(); // Should write content
    expect(writeJsonSpy).toHaveBeenCalled(); // Should write metadata
    expect(result.type).toBe('image/png');
  });

  it('serves from disk on cache hit', async () => {
    const gateway = new AssetGateway(root);

    pathExistsSpy.mockResolvedValue(true); // Hit
    readJsonSpy.mockResolvedValue({ type: 'image/jpeg' });
    createReadStreamSpy.mockReturnValue('cached-stream');

    const result = await gateway.fetchAsset('http://remote.com/img.jpg');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.type).toBe('image/jpeg');
  });

  it('rewrites HTML correctly', () => {
    const gateway = new AssetGateway(root);
    const html = '<img src="https://lh3.googleusercontent.com/xyz" />';
    const rewritten = gateway.rewriteHtmlForPreview(html);
    expect(rewritten).toContain('/_stitch/asset?url=');
    expect(rewritten).toContain(encodeURIComponent('https://lh3.googleusercontent.com/xyz'));
  });
});
