import { $ } from 'bun';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

async function verify() {
  console.log('Building...');
  await $`bun run build`;

  console.log('Packing...');
  const packOutput = await $`npm pack`.text();
  const tgzName = packOutput.trim().split('\n').pop()?.trim();

  if (!tgzName || !tgzName.endsWith('.tgz')) {
    throw new Error(`Failed to determine tgz name from output: ${packOutput}`);
  }

  console.log(`Packed: ${tgzName}`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stitch-verify-'));
  console.log(`Verifying in ${tmpDir}...`);

  try {
    await $`tar -xf ${tgzName} -C ${tmpDir}`;

    const packageDir = path.join(tmpDir, 'package');
    const binPath = path.join(packageDir, 'bin', 'stitch-mcp.js');

    if (!fs.existsSync(binPath)) {
      throw new Error(`Bin not found at ${binPath}`);
    }

    // Install dependencies (needed for external packages like vite)
    console.log('Installing dependencies...');
    await $`cd ${packageDir} && npm install --omit=dev`;

    console.log('Running version check with Node...');
    // Use node explicitly to verify compatibility
    const versionOutput = await $`node ${binPath} --version`.text();
    console.log(`Version: ${versionOutput.trim()}`);

    console.log('Running init help check...');
    const helpOutput = await $`node ${binPath} init --help`.text();
    if (!helpOutput.includes('--client')) {
      throw new Error('Help output missing --client flag');
    }

    // Test commands that use Vite to catch bundling regressions
    console.log('Running serve help check (uses Vite)...');
    const serveHelp = await $`node ${binPath} serve --help`.text();
    if (!serveHelp.includes('--project')) {
      throw new Error('Serve help output missing --project flag');
    }

    console.log('Running site help check (uses Vite)...');
    const siteHelp = await $`node ${binPath} site --help`.text();
    if (!siteHelp.includes('--project')) {
      throw new Error('Site help output missing --project flag');
    }

    console.log('✅ Package verification successful!');
  } catch (e) {
    console.error('❌ Verification failed:', e);
    process.exit(1);
  } finally {
    // Cleanup tgz
    if (fs.existsSync(tgzName)) {
      fs.unlinkSync(tgzName);
    }
    // Cleanup tmp
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

verify();
