import { describe, it, expect } from 'bun:test';
import { validateAssetUrl } from './url-allowlist.js';

describe('validateAssetUrl', () => {
  // === Contract Tests (Red → Green) ===

  describe('allowed domains', () => {
    const allowedUrls = [
      'https://fonts.googleapis.com/css2?family=Roboto',
      'https://lh3.googleusercontent.com/some-image',
      'https://fonts.gstatic.com/s/roboto/v30/font.woff2',
      'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
      'https://unpkg.com/react@18/umd/react.production.min.js',
      'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
      'https://lh3.ggpht.com/some-image',
    ];

    for (const url of allowedUrls) {
      it(`allows ${new URL(url).hostname}`, () => {
        const result = validateAssetUrl(url);
        expect(result.valid).toBe(true);
      });
    }
  });

  describe('blocked protocols', () => {
    it('rejects HTTP URLs', () => {
      const result = validateAssetUrl('http://fonts.googleapis.com/css');
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.code).toBe('PROTOCOL_NOT_ALLOWED');
    });

    it('rejects file:// URLs', () => {
      const result = validateAssetUrl('file:///etc/passwd');
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.code).toBe('PROTOCOL_NOT_ALLOWED');
    });

    it('rejects ftp:// URLs', () => {
      const result = validateAssetUrl('ftp://evil.com/file');
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.code).toBe('PROTOCOL_NOT_ALLOWED');
    });
  });

  describe('blocked internal addresses', () => {
    const internalUrls = [
      'https://localhost/secret',
      'https://127.0.0.1/secret',
      'https://169.254.169.254/latest/meta-data/',
      'https://10.0.0.1/internal',
      'https://192.168.1.1/admin',
      'https://172.16.0.1/internal',
      'https://metadata.internal/computeMetadata',
      'https://something.local/api',
    ];

    for (const url of internalUrls) {
      it(`blocks ${new URL(url).hostname}`, () => {
        const result = validateAssetUrl(url);
        expect(result.valid).toBe(false);
        if (!result.valid) expect(result.code).toBe('INTERNAL_ADDRESS');
      });
    }
  });

  describe('blocked external domains', () => {
    it('rejects unknown domains', () => {
      const result = validateAssetUrl('https://evil-server.com/steal-data');
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.code).toBe('DOMAIN_NOT_ALLOWED');
    });

    it('rejects domains that look similar to allowed ones', () => {
      const result = validateAssetUrl('https://googleapis.com.evil.com/api');
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.code).toBe('DOMAIN_NOT_ALLOWED');
    });
  });

  describe('malformed URLs', () => {
    it('rejects non-URL strings', () => {
      const result = validateAssetUrl('not a url at all');
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.code).toBe('INVALID_URL');
    });

    it('rejects empty string', () => {
      const result = validateAssetUrl('');
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.code).toBe('INVALID_URL');
    });
  });
});
