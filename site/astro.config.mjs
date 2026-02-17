// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { remarkRewriteLinks } from './src/lib/remark-rewrite-links';
import { rehypeTuiFrames } from './src/lib/rehype-tui-frames';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  markdown: {
    remarkPlugins: [remarkRewriteLinks],
    rehypePlugins: [rehypeTuiFrames],
    shikiConfig: {
      theme: 'css-variables',
    },
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
