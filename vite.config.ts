import { defineConfig } from 'vite';
import { builtinModules } from 'module';

export default defineConfig({
  build: {
    target: 'node18',
    outDir: 'dist',
    lib: {
      entry: {
        index: 'src/index.ts',
        cli: 'src/cli.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      // Match bun build behavior: bundle everything except specific externals and node builtins
      external: [
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
        'lightningcss',
        'vite',
        '@astrojs/compiler',
      ],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
    minify: false,
    emptyOutDir: true,
  },
});
