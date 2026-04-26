/**
 * Follow-up probe: variants + edit + a successful get_screen.
 * Reuses the project + screen created in 3-generate-screen.json.
 */
import 'dotenv/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = '.stitch-mcp/log-probe';
const URL2 = process.env.STITCH_MCP_URL ?? 'https://stitch.googleapis.com/mcp';

const prior = JSON.parse(await readFile(`${OUT}/3-generate-screen.json`, 'utf-8'));
const sc = prior.result.structuredContent;
const projectId: string = sc.projectId;
// Find the design component, take first screen
let screenId: string | undefined;
for (const c of sc.outputComponents) {
  if (c.design?.screens?.length) { screenId = c.design.screens[0].id; break; }
}
if (!projectId || !screenId) {
  throw new Error(`missing prior ids; projectId=${projectId} screenId=${screenId}`);
}
console.error(`reusing projectId=${projectId} screenId=${screenId}`);

await mkdir(OUT, { recursive: true });

const transport = new StreamableHTTPClientTransport(new URL(URL2), {
  requestInit: { headers: { 'X-Goog-Api-Key': process.env.STITCH_API_KEY!, Accept: 'application/json, text/event-stream' } },
});
const client = new Client({ name: 'log-probe-2', version: '0.0.0' }, { capabilities: {} });
await client.connect(transport);

const progressEvents: any[] = [];
async function call(label: string, name: string, args: any) {
  console.error(`\n[${label}] ${name}`);
  const t0 = Date.now();
  const myProgress: any[] = [];
  try {
    const result = await client.callTool({ name, arguments: args }, CallToolResultSchema, {
      timeout: 600_000,
      onprogress: (p: any) => { const ev = { ts: Date.now()-t0, ...p }; myProgress.push(ev); progressEvents.push({ label, ...ev }); console.error(`  progress`, p); },
    });
    const ms = Date.now() - t0;
    console.error(`  ok in ${ms}ms`);
    await writeFile(join(OUT, `${label}.json`), JSON.stringify({ duration_ms: ms, progress: myProgress, result }, null, 2));
  } catch (e: any) {
    const ms = Date.now() - t0;
    console.error(`  THREW in ${ms}ms:`, e?.message);
    await writeFile(join(OUT, `${label}.json`), JSON.stringify({ duration_ms: ms, progress: myProgress, threw: { message: e?.message, code: e?.code } }, null, 2));
  }
}

await call('4-generate-variants', 'generate_variants', {
  projectId,
  selectedScreenIds: [screenId],
  prompt: 'Vary the color scheme and the typographic layout',
  variantOptions: { variantCount: 2, creativeRange: 'EXPLORE', aspects: ['COLOR_SCHEME', 'LAYOUT'] },
});

await call('5-edit-screens', 'edit_screens', {
  projectId, selectedScreenIds: [screenId], prompt: 'Make the headline larger and serif',
});

await call('6-get-screen', 'get_screen', { projectId, screenId });

console.error(`\nProgress events captured: ${progressEvents.length}`);
await client.close();
