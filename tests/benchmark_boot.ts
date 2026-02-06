import { spawn } from 'child_process';
import { performance } from 'perf_hooks';

const start = performance.now();
const child = spawn('bun', ['run', 'src/cli.ts', 'init', '--help'], {
  stdio: 'ignore'
});

child.on('close', (code) => {
  const end = performance.now();
  console.log(`Execution time: ${(end - start).toFixed(2)}ms`);
  process.exit(code || 0);
});
