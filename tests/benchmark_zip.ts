import AdmZip from 'adm-zip';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(__dirname, 'temp_bench');
const zipPath = path.join(tempDir, 'test.zip');
const extractDirSync = path.join(tempDir, 'extract_sync');
const extractDirAsync = path.join(tempDir, 'extract_async');

async function setup() {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  const zip = new AdmZip();
  // Create some dummy content (~10MB)
  const content = 'a'.repeat(1024 * 1024); // 1MB
  for (let i = 0; i < 10; i++) {
    zip.addFile(`file_${i}.txt`, Buffer.from(content));
  }
  zip.writeZip(zipPath);
  console.log(`Created test zip at ${zipPath} size: ${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB`);
}

async function benchmarkSync() {
  if (fs.existsSync(extractDirSync)) {
    fs.rmSync(extractDirSync, { recursive: true, force: true });
  }
  fs.mkdirSync(extractDirSync, { recursive: true });

  const start = performance.now();
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(extractDirSync, true);
  const end = performance.now();

  return end - start;
}

async function benchmarkAsync() {
  if (fs.existsSync(extractDirAsync)) {
    fs.rmSync(extractDirAsync, { recursive: true, force: true });
  }
  fs.mkdirSync(extractDirAsync, { recursive: true });

  const start = performance.now();
  const zip = new AdmZip(zipPath);
  await new Promise<void>((resolve, reject) => {
    zip.extractAllToAsync(extractDirAsync, true, false, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  const end = performance.now();

  return end - start;
}

async function run() {
  try {
    await setup();

    console.log('Running Sync Benchmark...');
    const syncTime = await benchmarkSync();
    console.log(`Sync extraction time: ${syncTime.toFixed(2)}ms`);

    console.log('Running Async Benchmark...');
    const asyncTime = await benchmarkAsync();
    console.log(`Async extraction time: ${asyncTime.toFixed(2)}ms`);

    // Check if files exist
    const syncFiles = fs.readdirSync(extractDirSync);
    const asyncFiles = fs.readdirSync(extractDirAsync);
    console.log(`Sync extracted files: ${syncFiles.length}`);
    console.log(`Async extracted files: ${asyncFiles.length}`);

    if (syncFiles.length !== asyncFiles.length) {
      console.error('Mismatch in file count!');
      process.exit(1);
    }

  } catch (error) {
    console.error('Benchmark failed:', error);
  } finally {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

run();
