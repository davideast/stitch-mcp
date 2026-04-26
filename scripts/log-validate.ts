/**
 * Validation prototype for the logging system.
 *
 * Replays every probe artifact (real Stitch responses) through the proposed
 * file structure to verify mechanical/structural correctness, then runs ONE
 * live get_screen call to exercise the end-to-end live path. Prints stats and
 * sample queries so we can assess the structure on real data.
 *
 * Output goes to .stitch-mcp/log/  (events.jsonl + blobs/ + index/).
 * Reset between runs by deleting that directory.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, appendFile, rename, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';

const ROOT = '.stitch-mcp/log';
const PROBE = '.stitch-mcp/log-probe';

// --------------------------------------------------------------------------
// Schemas (locked from earlier conversation)
// --------------------------------------------------------------------------

const BlobRef = z.object({ sha256: z.string(), size: z.number(), mime: z.string() });
type BlobRef = z.infer<typeof BlobRef>;

const ProducedScreen = z.object({
  project_id: z.string(),
  screen_id: z.string(),
  name: z.string(),
  title: z.string().optional(),
  device_type: z.string().optional(),
  generated_by: z.string().optional(),
  agent_type: z.string().optional(),
  status: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  parent_screen_id: z.string().nullable(),
  sibling_screen_ids: z.array(z.string()),
  effective_prompt: z.string().optional(),
  html_file_name: z.string().optional(),
  screenshot_file_name: z.string().optional(),
  html_blob: BlobRef.optional(),
  screenshot_blob: BlobRef.optional(),
  theme_blob: BlobRef.optional(),
  design_system_blob: BlobRef.optional(),
});

const ReadSummary = z.object({
  project_id: z.string().optional(),
  screen_id: z.string().optional(),
  title: z.string().optional(),
  device_type: z.string().optional(),
  html_file_name: z.string().optional(),
  screenshot_file_name: z.string().optional(),
  project_count: z.number().optional(),
  project_ids: z.array(z.string()).optional(),
  screen_count: z.number().optional(),
  screen_ids: z.array(z.string()).optional(),
});

const Envelope = z.object({
  id: z.string(),
  time: z.string(),
  trace_id: z.string(),
  schema_version: z.literal(1),
  type: z.enum(['call.requested', 'call.completed', 'call.failed', 'observation']),
});

const RequestedPayload = z.object({
  tool: z.string(),
  project_id: z.string().optional(),
  selected_screen_ids: z.array(z.string()).optional(),
  user_prompt: z.string().optional(),
  variant_options: z.record(z.string(), z.unknown()).optional(),
  device_type: z.string().optional(),
  model_id: z.string().optional(),
  args_blob: BlobRef,
});

const CompletedPayload = z.object({
  tool: z.string(),
  duration_ms: z.number(),
  kind: z.enum(['generative', 'read']),
  stitch_session_id: z.string().optional(),
  structured_content_blob: BlobRef.optional(),
  produced_screens: z.array(ProducedScreen).optional(),
  text_components: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
  design_system_asset_name: z.string().optional(),
  read_summary: ReadSummary.optional(),
});

const FailedPayload = z.object({
  tool: z.string(),
  duration_ms: z.number(),
  is_error: z.union([z.literal(true), z.literal('empty')]),
  error_text: z.string().optional(),
  raw_blob: BlobRef.optional(),
});

const READ_TOOLS = new Set(['get_screen', 'list_screens', 'list_projects', 'get_project', 'create_project']);
const GEN_TOOLS = new Set(['generate_screen_from_text', 'edit_screens', 'generate_variants']);

// --------------------------------------------------------------------------
// Tiny helpers
// --------------------------------------------------------------------------

let counter = 0;
function nextId(): string {
  // sortable: unix-ms-base36 + counter + random
  const t = Date.now().toString(36).padStart(8, '0');
  const c = (counter++).toString(36).padStart(3, '0');
  const r = Math.floor(Math.random() * 1e9).toString(36);
  return `${t}${c}${r}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function extForMime(m: string): string {
  if (m.startsWith('text/html')) return 'html';
  if (m.startsWith('image/png')) return 'png';
  if (m.startsWith('image/webp')) return 'webp';
  if (m.startsWith('image/jpeg')) return 'jpg';
  if (m.startsWith('application/json') || m.includes('json')) return 'json';
  return 'bin';
}

async function ensureDir(p: string) { await mkdir(p, { recursive: true }); }

// --------------------------------------------------------------------------
// Blob store
// --------------------------------------------------------------------------

class BlobStore {
  private root: string;
  constructor(root: string) { this.root = root; }

  async putBuffer(buf: Buffer, mime: string): Promise<BlobRef> {
    const sha = createHash('sha256').update(buf).digest('hex');
    const ext = extForMime(mime);
    const dir = join(this.root, sha.slice(0, 2));
    await ensureDir(dir);
    const final = join(dir, `${sha}.${ext}`);
    try {
      const s = await stat(final);
      // already exists — dedupped
      return { sha256: sha, size: s.size, mime };
    } catch { /* not present */ }
    const tmp = join(this.root, '..', 'tmp', `${sha}.${ext}.partial`);
    await ensureDir(dirname(tmp));
    await writeFile(tmp, buf);
    await rename(tmp, final);
    return { sha256: sha, size: buf.length, mime };
  }

  async putJson(value: unknown): Promise<BlobRef> {
    const buf = Buffer.from(JSON.stringify(value));
    return this.putBuffer(buf, 'application/json');
  }

  async fetchAndPut(url: string, fallbackMime?: string): Promise<{ ref: BlobRef; ok: boolean }> {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120 stitch-mcp-log/0.1' },
      });
      if (!res.ok) return { ref: { sha256: '', size: 0, mime: fallbackMime ?? '' }, ok: false };
      const mime = res.headers.get('content-type')?.split(';')[0] ?? fallbackMime ?? 'application/octet-stream';
      const buf = Buffer.from(await res.arrayBuffer());
      const ref = await this.putBuffer(buf, mime);
      return { ref, ok: true };
    } catch {
      return { ref: { sha256: '', size: 0, mime: fallbackMime ?? '' }, ok: false };
    }
  }
}

// --------------------------------------------------------------------------
// Event store
// --------------------------------------------------------------------------

class EventStore {
  constructor(public root: string, public blobs: BlobStore) {}

  async append(event: unknown): Promise<void> {
    Envelope.parse(event); // validate envelope shape early
    const line = JSON.stringify(event) + '\n';
    await appendFile(join(this.root, 'events.jsonl'), line, 'utf8');
  }
}

// --------------------------------------------------------------------------
// Capture pipeline — turn (request, response, duration) into events
// --------------------------------------------------------------------------

interface CaptureCtx {
  store: EventStore;
  blobs: BlobStore;
}

function pickScreenComponents(structured: any): any[] {
  const oc: any[] = structured?.outputComponents ?? [];
  const screens: any[] = [];
  for (const c of oc) if (c?.design?.screens) screens.push(...c.design.screens);
  return screens;
}

function pickTextComponents(structured: any): string[] {
  return (structured?.outputComponents ?? []).flatMap((c: any) => (typeof c?.text === 'string' ? [c.text] : []));
}

function pickSuggestions(structured: any): string[] {
  return (structured?.outputComponents ?? []).flatMap((c: any) => (typeof c?.suggestion === 'string' ? [c.suggestion] : []));
}

function pickDesignSystemComponent(structured: any): any | null {
  const c = (structured?.outputComponents ?? []).find((x: any) => x?.designSystem);
  return c?.designSystem ?? null;
}

async function captureCall(
  ctx: CaptureCtx,
  args: Record<string, unknown>,
  tool: string,
  result: any,
  durationMs: number,
  startedAt: string,
  finishedAt: string,
): Promise<{ trace_id: string; producedScreenIds: string[] }> {
  const trace_id = nextId();
  const argsBlob = await ctx.blobs.putJson(args);

  // requested
  const requestedPayload: z.infer<typeof RequestedPayload> = {
    tool,
    args_blob: argsBlob,
    project_id: typeof args.projectId === 'string' ? args.projectId : undefined,
    selected_screen_ids: Array.isArray(args.selectedScreenIds) ? args.selectedScreenIds as string[] : undefined,
    user_prompt: typeof args.prompt === 'string' ? args.prompt : undefined,
    variant_options: typeof args.variantOptions === 'object' && args.variantOptions ? args.variantOptions as any : undefined,
    device_type: typeof args.deviceType === 'string' ? args.deviceType : undefined,
    model_id: typeof args.modelId === 'string' ? args.modelId : undefined,
  };
  await ctx.store.append({
    id: nextId(), time: startedAt, trace_id, schema_version: 1,
    type: 'call.requested', payload: RequestedPayload.parse(requestedPayload),
  });

  // failure: explicit
  if (result?.isError) {
    const errorText = result?.content?.[0]?.text ?? '';
    const rawBlob = await ctx.blobs.putJson(result);
    await ctx.store.append({
      id: nextId(), time: finishedAt, trace_id, schema_version: 1,
      type: 'call.failed', payload: FailedPayload.parse({ tool, duration_ms: durationMs, is_error: true, error_text: errorText, raw_blob: rawBlob }),
    });
    return { trace_id, producedScreenIds: [] };
  }

  const sc = result?.structuredContent ?? null;
  const kind: 'generative' | 'read' = GEN_TOOLS.has(tool) ? 'generative' : 'read';

  if (kind === 'read') {
    const summary: z.infer<typeof ReadSummary> = {};
    if (tool === 'get_screen') {
      summary.project_id = (args.projectId as string) ?? undefined;
      summary.screen_id = (args.screenId as string) ?? undefined;
      summary.title = sc?.title;
      summary.device_type = sc?.deviceType;
      summary.html_file_name = sc?.htmlCode?.name;
      summary.screenshot_file_name = sc?.screenshot?.name;
    } else if (tool === 'list_screens') {
      summary.project_id = (args.projectId as string) ?? undefined;
      const screens: any[] = sc?.screens ?? [];
      summary.screen_count = screens.length;
      summary.screen_ids = screens.map(s => s?.id ?? s?.name?.split('/screens/')[1]).filter(Boolean);
    } else if (tool === 'list_projects') {
      const projects: any[] = sc?.projects ?? [];
      summary.project_count = projects.length;
      summary.project_ids = projects.map(p => p?.name?.replace(/^projects\//, '')).filter(Boolean);
    } else if (tool === 'get_project') {
      summary.project_id = sc?.name?.replace(/^projects\//, '');
      summary.title = sc?.title;
    } else if (tool === 'create_project') {
      summary.project_id = sc?.name?.replace(/^projects\//, '');
      summary.title = sc?.title;
    }
    await ctx.store.append({
      id: nextId(), time: finishedAt, trace_id, schema_version: 1,
      type: 'call.completed',
      payload: CompletedPayload.parse({ tool, duration_ms: durationMs, kind: 'read', read_summary: summary }),
    });
    return { trace_id, producedScreenIds: [] };
  }

  // generative
  const screens = pickScreenComponents(sc);
  const ds = pickDesignSystemComponent(sc);
  const designSystemBlob = ds ? await ctx.blobs.putJson(ds) : undefined;
  const dsAssetName: string | undefined = ds?.name;
  const stitchSessionId: string | undefined = sc?.sessionId ? String(sc.sessionId) : undefined;

  const selectedParents: string[] = (args.selectedScreenIds as string[] | undefined) ?? [];
  const parentScreenId = selectedParents[0] ?? null;
  const allIds = screens.map(s => s.id).filter(Boolean);

  const produced: z.infer<typeof ProducedScreen>[] = [];
  for (const s of screens) {
    const sibs = allIds.filter(id => id !== s.id);
    const themeBlob = s.theme && Object.keys(s.theme).length > 0 ? await ctx.blobs.putJson(s.theme) : undefined;
    let htmlBlob: BlobRef | undefined;
    let screenshotBlob: BlobRef | undefined;
    if (s.htmlCode?.downloadUrl) {
      const r = await ctx.blobs.fetchAndPut(s.htmlCode.downloadUrl, s.htmlCode.mimeType);
      if (r.ok) htmlBlob = r.ref;
    }
    if (s.screenshot?.downloadUrl) {
      const r = await ctx.blobs.fetchAndPut(s.screenshot.downloadUrl);
      if (r.ok) screenshotBlob = r.ref;
    }
    produced.push(ProducedScreen.parse({
      project_id: (args.projectId as string) ?? sc?.projectId ?? '',
      screen_id: s.id,
      name: s.name,
      title: s.title,
      device_type: s.deviceType,
      generated_by: s.generatedBy,
      agent_type: s.screenMetadata?.agentType,
      status: s.screenMetadata?.status,
      width: typeof s.width === 'string' ? parseInt(s.width) : s.width,
      height: typeof s.height === 'string' ? parseInt(s.height) : s.height,
      parent_screen_id: parentScreenId,
      sibling_screen_ids: sibs,
      effective_prompt: s.prompt,
      html_file_name: s.htmlCode?.name,
      screenshot_file_name: s.screenshot?.name,
      html_blob: htmlBlob,
      screenshot_blob: screenshotBlob,
      theme_blob: themeBlob,
      design_system_blob: designSystemBlob,
    }));
  }

  // implicit failure: zero screens
  if (produced.length === 0) {
    const rawBlob = await ctx.blobs.putJson(result);
    await ctx.store.append({
      id: nextId(), time: finishedAt, trace_id, schema_version: 1,
      type: 'call.failed', payload: FailedPayload.parse({ tool, duration_ms: durationMs, is_error: 'empty', raw_blob: rawBlob }),
    });
    return { trace_id, producedScreenIds: [] };
  }

  const structuredBlob = sc ? await ctx.blobs.putJson(sc) : undefined;
  await ctx.store.append({
    id: nextId(), time: finishedAt, trace_id, schema_version: 1,
    type: 'call.completed',
    payload: CompletedPayload.parse({
      tool, duration_ms: durationMs, kind: 'generative',
      stitch_session_id: stitchSessionId,
      structured_content_blob: structuredBlob,
      produced_screens: produced,
      text_components: pickTextComponents(sc),
      suggestions: pickSuggestions(sc),
      design_system_asset_name: dsAssetName,
    }),
  });
  return { trace_id, producedScreenIds: produced.map(p => p.screen_id) };
}

// --------------------------------------------------------------------------
// Index builder
// --------------------------------------------------------------------------

async function buildIndex(root: string) {
  const indexDir = join(root, 'index');
  await ensureDir(indexDir);
  await ensureDir(join(indexDir, 'by-project'));

  const lines = (await readFile(join(root, 'events.jsonl'), 'utf8')).split('\n').filter(Boolean);
  const events = lines.map(l => JSON.parse(l));

  const screens = new Map<string, any>();
  const prompts: any[] = [];
  const lineage: any[] = [];
  const byProject = new Map<string, any[]>();
  const requestedById = new Map<string, any>();

  for (const ev of events) {
    if (ev.type === 'call.requested') requestedById.set(ev.trace_id, ev);
    if (ev.type === 'call.completed') {
      const p = ev.payload;
      const projId = p.read_summary?.project_id ?? p.produced_screens?.[0]?.project_id;
      if (projId) {
        const arr = byProject.get(projId) ?? [];
        arr.push({ event_id: ev.id, time: ev.time, type: ev.type, tool: p.tool, screen_ids: (p.produced_screens ?? []).map((s: any) => s.screen_id) });
        byProject.set(projId, arr);
      }
      if (p.kind === 'generative' && p.produced_screens) {
        const req = requestedById.get(ev.trace_id);
        const userPrompt = req?.payload?.user_prompt;
        for (const s of p.produced_screens) {
          screens.set(s.screen_id, {
            screen_id: s.screen_id,
            project_id: s.project_id,
            title: s.title,
            device_type: s.device_type,
            root: s.parent_screen_id == null,
            parent_screen_id: s.parent_screen_id,
            created_by_event_id: ev.id,
            created_at: ev.time,
            user_prompt: userPrompt,
            effective_prompt: s.effective_prompt,
            html_blob: s.html_blob,
            screenshot_blob: s.screenshot_blob,
            theme_blob: s.theme_blob,
            signals: [],
          });
          prompts.push({
            screen_id: s.screen_id,
            tool: p.tool,
            trace_id: ev.trace_id,
            user_prompt: userPrompt,
            effective_prompt: s.effective_prompt,
            design_system_asset_name: p.design_system_asset_name ?? null,
            variant_options: req?.payload?.variant_options ?? null,
            signal: null,
          });
          if (s.parent_screen_id) {
            lineage.push({
              parent_screen_id: s.parent_screen_id,
              child_screen_id: s.screen_id,
              relation: p.tool === 'edit_screens' ? 'edited_into' : p.tool === 'generate_variants' ? 'variant_of' : 'derived',
              sibling_screen_ids: s.sibling_screen_ids ?? [],
              trace_id: ev.trace_id,
              tool: p.tool,
              time: ev.time,
            });
          }
        }
      }
    }
  }

  // Derived signals: a screen that was viewed (read on it) after an edit/generation = "viewed"
  const signals: any[] = [];
  const byScreenViews = new Map<string, string[]>();
  for (const ev of events) {
    if (ev.type === 'call.completed' && ev.payload.kind === 'read' && ev.payload.tool === 'get_screen' && ev.payload.read_summary?.screen_id) {
      const sid = ev.payload.read_summary.screen_id;
      const arr = byScreenViews.get(sid) ?? [];
      arr.push(ev.id);
      byScreenViews.set(sid, arr);
    }
  }
  for (const [sid, viewIds] of byScreenViews) {
    const sc = screens.get(sid);
    if (sc) {
      sc.signals.push('viewed');
      signals.push({ screen_id: sid, signal: 'viewed', reason: `get_screen called ${viewIds.length}x`, source_event_ids: viewIds });
    }
  }
  // Variant survivor / abandoned: among siblings, ones with any downstream activity = survivor
  for (const ev of events) {
    if (ev.type === 'call.completed' && ev.payload.kind === 'generative' && ev.payload.tool === 'generate_variants' && ev.payload.produced_screens?.length) {
      for (const s of ev.payload.produced_screens) {
        const hasDownstream = lineage.some(l => l.parent_screen_id === s.screen_id) || byScreenViews.has(s.screen_id);
        const sig = hasDownstream ? 'variant_survivor' : 'abandoned';
        signals.push({ screen_id: s.screen_id, signal: sig, reason: 'variant outcome inferred from downstream activity', source_event_id: ev.id });
        const sc = screens.get(s.screen_id);
        if (sc) sc.signals.push(sig);
      }
    }
  }

  // Write
  await writeFile(join(indexDir, 'screens.jsonl'), [...screens.values()].map(s => JSON.stringify(s)).join('\n') + '\n');
  await writeFile(join(indexDir, 'prompts.jsonl'), prompts.map(p => JSON.stringify(p)).join('\n') + '\n');
  await writeFile(join(indexDir, 'lineage.jsonl'), lineage.map(l => JSON.stringify(l)).join('\n') + '\n');
  await writeFile(join(indexDir, 'signals.jsonl'), signals.map(s => JSON.stringify(s)).join('\n') + '\n');
  for (const [pid, arr] of byProject) {
    await writeFile(join(indexDir, 'by-project', `${pid}.jsonl`), arr.map(a => JSON.stringify(a)).join('\n') + '\n');
  }
  await writeFile(join(indexDir, 'meta.json'), JSON.stringify({
    schema_version: 1,
    built_through_event_id: events[events.length - 1]?.id ?? null,
    built_at: nowIso(),
    counts: { events: events.length, screens: screens.size, prompts: prompts.length, lineage: lineage.length, signals: signals.length },
  }, null, 2));
}

// --------------------------------------------------------------------------
// Driver
// --------------------------------------------------------------------------

interface ProbeReplay {
  label: string;
  tool: string;
  args: Record<string, unknown>;
  resultFile: string;
}

// Reconstruct the args we sent in scripts/log-probe{,-2}.ts
function probeReplays(projectId: string, screenId: string): ProbeReplay[] {
  return [
    { label: '1', tool: 'list_projects', args: {}, resultFile: '1-list-projects.json' },
    { label: '2', tool: 'create_project', args: { title: `log-probe-replay` }, resultFile: '2-create-project.json' },
    { label: '3', tool: 'generate_screen_from_text', args: { projectId, prompt: 'A minimal landing page for a typography-focused blog. One headline, one paragraph, one CTA.' }, resultFile: '3-generate-screen.json' },
    { label: '4', tool: 'generate_variants', args: { projectId, selectedScreenIds: [screenId], prompt: 'Vary the color scheme and the typographic layout', variantOptions: { variantCount: 2, creativeRange: 'EXPLORE', aspects: ['COLOR_SCHEME', 'LAYOUT'] } }, resultFile: '4-generate-variants.json' },
    { label: '5', tool: 'edit_screens', args: { projectId, selectedScreenIds: [screenId], prompt: 'Make the headline larger and serif' }, resultFile: '5-edit-screens.json' },
    { label: '6', tool: 'get_screen', args: { projectId, screenId }, resultFile: '6-get-screen.json' },
    { label: '7', tool: 'get_project', args: { name: `projects/${projectId}` }, resultFile: '7-get-project-after.json' },
    { label: '8', tool: 'get_screen', args: { projectId: '0', screenId: 'doesnotexist' }, resultFile: '8-fail-bogus-screen.json' },
    { label: '9', tool: 'edit_screens', args: { projectId }, resultFile: '9-fail-missing-required.json' },
  ];
}

async function main() {
  console.error('=== reset .stitch-mcp/log/ ===');
  // intentionally do not delete — we want to be append-only; user can `rm -rf` if needed
  await ensureDir(ROOT);
  await ensureDir(join(ROOT, 'blobs'));
  await ensureDir(join(ROOT, 'index'));
  await ensureDir(join(ROOT, 'tmp'));

  const blobs = new BlobStore(join(ROOT, 'blobs'));
  const store = new EventStore(ROOT, blobs);

  // discover the projectId / screenId from probe artifact
  const gen = JSON.parse(await readFile(join(PROBE, '3-generate-screen.json'), 'utf8'));
  const sc = gen.result.structuredContent;
  const projectId: string = sc.projectId;
  const screenId: string = pickScreenComponents(sc)[0].id;

  console.error(`projectId=${projectId} firstScreenId=${screenId}`);

  // 1) Replay probes
  const replays = probeReplays(projectId, screenId);
  for (const r of replays) {
    const path = join(PROBE, r.resultFile);
    let probe: any;
    try { probe = JSON.parse(await readFile(path, 'utf8')); } catch { console.error(`SKIP ${r.label} (missing ${path})`); continue; }
    const result = probe.result ?? null;
    const duration = probe.duration_ms ?? 0;
    if (result == null) { console.error(`SKIP ${r.label} (probe THREW: ${JSON.stringify(probe.threw)})`); continue; }
    const finishedAt = nowIso();
    const startedAt = new Date(Date.now() - duration).toISOString();
    const { trace_id, producedScreenIds } = await captureCall({ store, blobs }, r.args, r.tool, result, duration, startedAt, finishedAt);
    console.error(`  [${r.label}] ${r.tool} trace=${trace_id.slice(0,12)} produced=${producedScreenIds.length}`);
  }

  // 2) One LIVE call to validate the live path end-to-end
  console.error('\n=== live get_screen ===');
  const transport = new StreamableHTTPClientTransport(new URL(process.env.STITCH_MCP_URL ?? 'https://stitch.googleapis.com/mcp'), {
    requestInit: { headers: { 'X-Goog-Api-Key': process.env.STITCH_API_KEY!, Accept: 'application/json, text/event-stream' } },
  });
  const client = new Client({ name: 'log-validate', version: '0.0.0' }, { capabilities: {} });
  await client.connect(transport);
  const t0 = Date.now();
  const startedAt = nowIso();
  const liveArgs = { projectId, screenId };
  const liveResult = await client.callTool({ name: 'get_screen', arguments: liveArgs }, CallToolResultSchema);
  const dur = Date.now() - t0;
  await captureCall({ store, blobs }, liveArgs, 'get_screen', liveResult, dur, startedAt, nowIso());
  console.error(`  live get_screen ok in ${dur}ms`);
  await client.close();

  // 3) Build index
  console.error('\n=== build index ===');
  const t1 = Date.now();
  await buildIndex(ROOT);
  console.error(`  index built in ${Date.now() - t1}ms`);
}

await main();
