// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { remarkRewriteLinks } from './src/lib/remark-rewrite-links';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  markdown: {
    remarkPlugins: [remarkRewriteLinks],
    shikiConfig: {
      theme: 'css-variables',
    },
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
