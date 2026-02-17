// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { remarkRewriteLinks } from './src/lib/remark-rewrite-links';
import { rehypeTuiFrames } from './src/lib/rehype-tui-frames';

const base = '/stitch-mcp';

// https://astro.build/config
export default defineConfig({
  site: 'https://davideast.github.io',
  base,
  integrations: [react()],

  markdown: {
    remarkPlugins: [[remarkRewriteLinks, { base }]],
    rehypePlugins: [rehypeTuiFrames],
    shikiConfig: {
      theme: 'css-variables',
    },
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
