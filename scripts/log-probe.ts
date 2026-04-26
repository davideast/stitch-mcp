/**
 * One-off probe to capture raw wire shapes for the logging-system design.
 * Saves verbatim envelopes to .stitch-mcp/log-probe/.
 *
 * Run:  STITCH_API_KEY=... bun scripts/log-probe.ts
 */
import 'dotenv/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = '.stitch-mcp/log-probe';
const STITCH_URL = process.env.STITCH_MCP_URL ?? 'https://stitch.googleapis.com/mcp';

if (!process.env.STITCH_API_KEY) {
  console.error('STITCH_API_KEY required');
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

const transport = new StreamableHTTPClientTransport(new URL(STITCH_URL), {
  requestInit: {
    headers: {
      'X-Goog-Api-Key': process.env.STITCH_API_KEY!,
      Accept: 'application/json, text/event-stream',
    },
  },
});

const client = new Client({ name: 'log-probe', version: '0.0.0' }, { capabilities: {} });
await client.connect(transport);

const progressEvents: any[] = [];

async function dump(label: string, data: unknown) {
  const file = join(OUT, `${label}.json`);
  await writeFile(file, JSON.stringify(data, null, 2));
  console.error(`  -> ${file} (${JSON.stringify(data).length} bytes)`);
}

async function call(label: string, name: string, args: Record<string, unknown>, opts: { progress?: boolean } = {}) {
  console.error(`\n[${label}] ${name}`);
  const t0 = Date.now();
  const myProgress: any[] = [];
  try {
    const result = await client.callTool(
      { name, arguments: args },
      CallToolResultSchema,
      {
        timeout: 600_000,
        onprogress: opts.progress
          ? (p: any) => {
              const ev = { ts: Date.now() - t0, ...p };
              myProgress.push(ev);
              progressEvents.push({ label, ...ev });
              console.error(`  progress @${ev.ts}ms`, p);
            }
          : undefined,
      },
    );
    const ms = Date.now() - t0;
    console.error(`  ok in ${ms}ms`);
    await dump(label, { duration_ms: ms, progress: myProgress, result });
    return result as any;
  } catch (e: any) {
    const ms = Date.now() - t0;
    console.error(`  THREW after ${ms}ms:`, e?.message ?? e);
    await dump(label, { duration_ms: ms, progress: myProgress, threw: { message: e?.message, code: e?.code, data: e?.data } });
    return null;
  }
}

// 1) cheap baseline
await call('1-list-projects', 'list_projects', {});

// 2) create throwaway project
const created = await call('2-create-project', 'create_project', { title: `log-probe-${Date.now()}` });
const createdSC: any = created?.structuredContent ?? (() => {
  try { return JSON.parse(created?.content?.[0]?.text ?? '{}'); } catch { return {}; }
})();
const projectName: string | undefined = createdSC?.name;
const projectId = projectName?.replace(/^projects\//, '');
console.error(`  projectId = ${projectId}`);

if (projectId) {
  // 3) generate one screen, request progress
  const gen = await call(
    '3-generate-screen',
    'generate_screen_from_text',
    { projectId, prompt: 'A minimal landing page for a typography-focused blog. One headline, one paragraph, one CTA.' },
    { progress: true },
  );
  const genSC: any = gen?.structuredContent ?? (() => {
    try { return JSON.parse(gen?.content?.[0]?.text ?? '{}'); } catch { return {}; }
  })();
  const firstScreenId = genSC?.outputComponents?.[0]?.design?.screens?.[0]?.id;
  console.error(`  firstScreenId = ${firstScreenId}`);

  // 4) variants on that screen, capture aspect attribution
  if (firstScreenId) {
    await call(
      '4-generate-variants',
      'generate_variants',
      {
        projectId,
        selectedScreenIds: [firstScreenId],
        prompt: 'Vary the color scheme and the layout',
        variantOptions: { variantCount: 2, creativeRange: 'EXPLORE', aspects: ['COLOR_SCHEME', 'LAYOUT'] },
      },
      { progress: true },
    );

    // 5) edit screens
    await call(
      '5-edit-screens',
      'edit_screens',
      { projectId, selectedScreenIds: [firstScreenId], prompt: 'Make the headline larger and serif' },
      { progress: true },
    );

    // 6) get_screen, look at envelope of read-only call
    await call('6-get-screen', 'get_screen', { projectId, screenId: firstScreenId });
  }

  // 7) post-state of project (designMd may have grown)
  await call('7-get-project-after', 'get_project', { name: `projects/${projectId}` });
}

// 8) deliberate failure: bogus screen id
await call('8-fail-bogus-screen', 'get_screen', { projectId: '0', screenId: 'doesnotexist' });

// 9) deliberate failure: missing required field (server-side, since SDK won't block raw call)
await call('9-fail-missing-required', 'edit_screens', { projectId: projectId ?? '0' } as any);

await writeFile(join(OUT, 'progress-summary.json'), JSON.stringify(progressEvents, null, 2));
console.error(`\nProgress events captured: ${progressEvents.length}`);

await client.close();
