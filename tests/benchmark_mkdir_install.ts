import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(__dirname, 'temp_mkdir_bench');

async function benchmarkSync() {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const start = performance.now();
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const end = performance.now();

  return end - start;
}

async function benchmarkAsyncOptimized() {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const start = performance.now();
  await fs.promises.mkdir(tempDir, { recursive: true });
  const end = performance.now();

  return end - start;
}

async function run() {
  let totalSync = 0;
  let totalAsync = 0;
  const ITERS = 100;

  for (let i = 0; i < ITERS; i++) {
     totalSync += await benchmarkSync();
     totalAsync += await benchmarkAsyncOptimized();
  }

  console.log(`Avg Sync mkdir time: ${(totalSync/ITERS).toFixed(4)}ms`);
  console.log(`Avg Async optimized mkdir time: ${(totalAsync/ITERS).toFixed(4)}ms`);

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

run();
