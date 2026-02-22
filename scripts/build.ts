import { build, Glob } from 'bun';

const commandGlob = new Glob('src/commands/*/command.ts');
const commandFiles = Array.from(commandGlob.scanSync({ cwd: '.' }));

console.log('Building Stitch CLI...');
console.log('Found commands:', commandFiles);

const result = await build({
  entrypoints: ['src/index.ts', 'src/cli.ts', ...commandFiles],
  outdir: 'dist',
  root: './src',
  target: 'node',
  format: 'esm',
  splitting: true,
  external: [
    'lightningcss',
    'vite',
    '@astrojs/compiler'
  ],
  sourcemap: 'external',
});

if (!result.success) {
  console.error('Build failed');
  for (const message of result.logs) {
    console.error(message);
  }
  process.exit(1);
} else {
  console.log('Build successful');
}
