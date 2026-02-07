import { expect, test, describe } from 'bun:test';
import { MockUI } from './MockUI.js';

describe('MockUI', () => {
  test('should return mcpClient from data', async () => {
    const ui = new MockUI({ mcpClient: 'vscode' });
    expect(await ui.promptMcpClient()).toBe('vscode');
  });

  test('should throw if mcpClient missing', async () => {
    const ui = new MockUI({});
    expect(ui.promptMcpClient()).rejects.toThrow('MockUI: Missing data for mcpClient');
  });

  test('should return authMode from data', async () => {
    const ui = new MockUI({ authMode: 'oauth' });
    expect(await ui.promptAuthMode()).toBe('oauth');
  });

  test('should throw if authMode missing', async () => {
    const ui = new MockUI({});
    expect(ui.promptAuthMode()).rejects.toThrow('MockUI: Missing data for authMode');
  });

  test('should return transportType from data', async () => {
    const ui = new MockUI({ transportType: 'http' });
    expect(await ui.promptTransportType()).toBe('http');
  });

  test('should throw if transportType missing', async () => {
    const ui = new MockUI({});
    expect(ui.promptTransportType()).rejects.toThrow('MockUI: Missing data for transportType');
  });

  test('should return apiKeyStorage from data', async () => {
      const ui = new MockUI({ apiKeyStorage: 'config' });
      expect(await ui.promptApiKeyStorage()).toBe('config');
  });

  test('should return apiKey from data', async () => {
      const ui = new MockUI({ apiKey: 'key123' });
      expect(await ui.promptApiKey()).toBe('key123');
  });

  test('should return confirm from data', async () => {
      const ui = new MockUI({ confirm: true });
      expect(await ui.promptConfirm('Are you sure?')).toBe(true);
  });

  test('should return defaultYes if confirm missing', async () => {
      const ui = new MockUI({});
      expect(await ui.promptConfirm('Are you sure?', true)).toBe(true);
      expect(await ui.promptConfirm('Are you sure?', false)).toBe(false);
  });
});
