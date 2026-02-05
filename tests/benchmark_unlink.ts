import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(__dirname, 'temp_unlink_bench');

async function setup(count: number) {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  for (let i = 0; i < count; i++) {
    fs.writeFileSync(path.join(tempDir, `file_${i}.txt`), 'some content');
  }
}

async function benchmarkSync(count: number) {
  await setup(count);
  const files = fs.readdirSync(tempDir).map(f => path.join(tempDir, f));

  const start = performance.now();
  for (const file of files) {
    fs.unlinkSync(file);
  }
  const end = performance.now();

  return end - start;
}

async function benchmarkAsync(count: number) {
  await setup(count);
  const files = fs.readdirSync(tempDir).map(f => path.join(tempDir, f));

  const start = performance.now();
  // Using Promise.all to simulate concurrent deletion which is possible with async
  const promises = files.map(file => fs.promises.unlink(file));
  await Promise.all(promises);
  const end = performance.now();

  return end - start;
}

async function run() {
  const COUNT = 1000;
  console.log(`Benchmarking deletion of ${COUNT} files...`);

  try {
    const syncTime = await benchmarkSync(COUNT);
    console.log(`Sync unlink time: ${syncTime.toFixed(2)}ms`);

    const asyncTime = await benchmarkAsync(COUNT);
    console.log(`Async unlink time: ${asyncTime.toFixed(2)}ms`);

    console.log(`Improvement: ${(syncTime - asyncTime).toFixed(2)}ms (${((syncTime - asyncTime) / syncTime * 100).toFixed(1)}%)`);

  } catch (error) {
    console.error('Benchmark failed:', error);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

run();
