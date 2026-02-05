import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(__dirname, 'temp_bench_adc');
const testFile = path.join(tempDir, 'test_file.txt');

const ITERATIONS = 10000;

async function setup() {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(testFile, 'test');
}

async function benchmarkSync() {
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    fs.existsSync(testFile);
  }
  const end = performance.now();
  return end - start;
}

async function benchmarkAsync() {
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    try {
      await fs.promises.access(testFile, fs.constants.F_OK);
    } catch {
      // ignore
    }
  }
  const end = performance.now();
  return end - start;
}

async function run() {
  try {
    await setup();

    console.log(`Running benchmarks with ${ITERATIONS} iterations...`);

    const syncTime = await benchmarkSync();
    console.log(`Sync fs.existsSync time: ${syncTime.toFixed(2)}ms`);

    const asyncTime = await benchmarkAsync();
    console.log(`Async fs.promises.access time: ${asyncTime.toFixed(2)}ms`);

  } catch (error) {
    console.error('Benchmark failed:', error);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

run();
