import type { RemoteScreen, UIScreen } from './types.js';
import fs from 'fs-extra';
import path from 'path';
import pLimit from 'p-limit';

export class SiteService {
  static toUIScreens(screens: RemoteScreen[]): UIScreen[] {
    return screens
      .filter((s) => s.htmlCode && s.htmlCode.downloadUrl)
      .map((s) => ({
        id: s.name,
        title: s.title,
        downloadUrl: s.htmlCode!.downloadUrl!,
        status: 'ignored',
        route: '',
      }));
  }

  static slugify(text: string): string {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }
}
