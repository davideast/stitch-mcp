import { randomUUID } from 'node:crypto';
import type { BlobRef } from '../blob-store/spec.js';
import {
  type AppendFn,
  type CaptureDeps,
  type CaptureInput,
  type CaptureResult,
  type CaptureSpec,
  type Event,
  type ProducedScreen,
  type ToolKind,
  CaptureInputSchema,
  kindOf,
} from './spec.js';

interface ScreenComponent {
  id?: string;
  name?: string;
  prompt?: string;
  theme?: Record<string, unknown>;
  designSystem?: Record<string, unknown> | null;
  htmlCode?: { downloadUrl?: string; mimeType?: string };
  screenshot?: { downloadUrl?: string };
}

export class CaptureHandler implements CaptureSpec {
  private readonly blobs: CaptureDeps['blobs'];
  private readonly append: AppendFn;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(deps: CaptureDeps) {
    this.blobs = deps.blobs;
    this.append = deps.append;
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => randomUUID());
  }

  async capture(input: CaptureInput): Promise<CaptureResult> {
    const parsed = CaptureInputSchema.safeParse(input);
    if (!parsed.success) {
      return this.fail('CAPTURE_INVALID_INPUT', parsed.error.message, false);
    }
    const kind: ToolKind = kindOf(input.tool);

    const trace_id = this.newId();
    const warnings: string[] = [];

    // 1) requested event — always
    const argsBuf = Buffer.from(JSON.stringify(input.args));
    const argsBlob = await this.blobs.put(argsBuf, 'application/json');
    if (!argsBlob.success) {
      return this.fail('CAPTURE_BLOB_FATAL', `args_blob: ${argsBlob.error.message}`, false);
    }

    const requested: Event = {
      id: this.newId(),
      time: input.started_at,
      trace_id,
      schema_version: 1,
      type: 'call.requested',
      payload: {
        tool: input.tool,
        project_id: typeof input.args.projectId === 'string' ? input.args.projectId : undefined,
        selected_screen_ids: Array.isArray(input.args.selectedScreenIds)
          ? (input.args.selectedScreenIds as string[])
          : undefined,
        user_prompt: typeof input.args.prompt === 'string' ? input.args.prompt : undefined,
        variant_options:
          input.args.variantOptions && typeof input.args.variantOptions === 'object'
            ? (input.args.variantOptions as Record<string, unknown>)
            : undefined,
        device_type: typeof input.args.deviceType === 'string' ? input.args.deviceType : undefined,
        model_id: typeof input.args.modelId === 'string' ? input.args.modelId : undefined,
        args_blob: argsBlob.data,
      },
    };
    const ar = await this.append(requested);
    if (!ar.success) return this.fail('CAPTURE_APPEND_FAILED', ar.error.message, true);

    // 2) explicit failure
    const r = input.result as { isError?: boolean; structuredContent?: any; content?: { type: string; text?: string }[] } | null;
    if (r && r.isError === true) {
      const errorText = r.content?.find((c) => c.type === 'text')?.text ?? '';
      const rawBlob = await this.blobs.put(Buffer.from(JSON.stringify(r)), 'application/json');
      const failed: Event = {
        id: this.newId(),
        time: input.finished_at,
        trace_id,
        schema_version: 1,
        type: 'call.failed',
        payload: {
          tool: input.tool,
          duration_ms: input.duration_ms,
          is_error: true,
          error_text: errorText,
          raw_blob: rawBlob.success ? rawBlob.data : undefined,
        },
      };
      const fr = await this.append(failed);
      if (!fr.success) return this.fail('CAPTURE_APPEND_FAILED', fr.error.message, true);
      return { success: true, data: { trace_id, produced_screen_ids: [], warnings } };
    }

    if (kind === 'read') {
      const resultBlob = await this.blobs.put(Buffer.from(JSON.stringify(r ?? {})), 'application/json');
      if (!resultBlob.success) {
        return this.fail('CAPTURE_BLOB_FATAL', `result_blob: ${resultBlob.error.message}`, false);
      }
      const returned = extractReturnedIds(r);
      const completed: Event = {
        id: this.newId(),
        time: input.finished_at,
        trace_id,
        schema_version: 1,
        type: 'call.completed',
        payload: {
          tool: input.tool,
          duration_ms: input.duration_ms,
          kind: 'read',
          project_id: typeof input.args.projectId === 'string' ? input.args.projectId : undefined,
          screen_ids:
            typeof input.args.screenId === 'string'
              ? [input.args.screenId]
              : Array.isArray(input.args.selectedScreenIds)
                ? (input.args.selectedScreenIds as string[])
                : undefined,
          returned_project_ids: returned.projects.length > 0 ? returned.projects : undefined,
          returned_screen_ids: returned.screens.length > 0 ? returned.screens : undefined,
          result_blob: resultBlob.data,
        },
      };
      const cr = await this.append(completed);
      if (!cr.success) return this.fail('CAPTURE_APPEND_FAILED', cr.error.message, true);
      return { success: true, data: { trace_id, produced_screen_ids: [], warnings } };
    }

    if (kind === 'unknown') {
      const resultBlob = await this.blobs.put(Buffer.from(JSON.stringify(r ?? {})), 'application/json');
      if (!resultBlob.success) {
        return this.fail('CAPTURE_BLOB_FATAL', `result_blob: ${resultBlob.error.message}`, false);
      }
      const completed: Event = {
        id: this.newId(),
        time: input.finished_at,
        trace_id,
        schema_version: 1,
        type: 'call.completed',
        payload: {
          tool: input.tool,
          duration_ms: input.duration_ms,
          kind: 'unknown',
          project_id: typeof input.args.projectId === 'string' ? input.args.projectId : undefined,
          result_blob: resultBlob.data,
        },
      };
      const cr = await this.append(completed);
      if (!cr.success) return this.fail('CAPTURE_APPEND_FAILED', cr.error.message, true);
      return { success: true, data: { trace_id, produced_screen_ids: [], warnings } };
    }

    // 3) generative path
    const sc = (r as any)?.structuredContent ?? null;
    const screens: ScreenComponent[] = pickScreens(sc);

    // implicit failure: zero produced screens on a generative call
    if (screens.length === 0) {
      const rawBlob = await this.blobs.put(Buffer.from(JSON.stringify(r ?? {})), 'application/json');
      const failed: Event = {
        id: this.newId(),
        time: input.finished_at,
        trace_id,
        schema_version: 1,
        type: 'call.failed',
        payload: {
          tool: input.tool,
          duration_ms: input.duration_ms,
          is_error: 'empty',
          raw_blob: rawBlob.success ? rawBlob.data : undefined,
        },
      };
      const fr = await this.append(failed);
      if (!fr.success) return this.fail('CAPTURE_APPEND_FAILED', fr.error.message, true);
      return { success: true, data: { trace_id, produced_screen_ids: [], warnings } };
    }

    const structuredBlob = await this.blobs.put(Buffer.from(JSON.stringify(sc)), 'application/json');
    if (!structuredBlob.success) {
      return this.fail('CAPTURE_BLOB_FATAL', `structured_content_blob: ${structuredBlob.error.message}`, false);
    }

    // top-level designSystem component (only on generate_screen_from_text in practice)
    const dsAsset = pickDesignSystemComponent(sc);
    let dsAssetBlob: BlobRef | null = null;
    if (dsAsset) {
      const r2 = await this.blobs.put(Buffer.from(JSON.stringify(dsAsset)), 'application/json');
      if (r2.success) dsAssetBlob = r2.data;
      else warnings.push(`design_system_asset put failed: ${r2.error.message}`);
    }

    const allScreenIds = screens.map((s) => s.id ?? '').filter(Boolean);
    const selectedParents = (input.args.selectedScreenIds as string[] | undefined) ?? [];
    const parent = selectedParents[0] ?? null;

    const produced: ProducedScreen[] = [];
    for (const s of screens) {
      const screenId = s.id ?? '';
      const siblings = allScreenIds.filter((id) => id !== screenId);

      // theme blob (populated for generate/edit; empty {} for variants)
      let themeBlob: BlobRef | null = null;
      if (s.theme && Object.keys(s.theme).length > 0) {
        const tr = await this.blobs.put(Buffer.from(JSON.stringify(s.theme)), 'application/json');
        if (tr.success) themeBlob = tr.data;
        else warnings.push(`screen ${screenId} theme: ${tr.error.message}`);
      }

      // per-screen design system (generate only)
      let dsBlob: BlobRef | null = null;
      if (s.designSystem) {
        const dr = await this.blobs.put(Buffer.from(JSON.stringify(s.designSystem)), 'application/json');
        if (dr.success) dsBlob = dr.data;
        else warnings.push(`screen ${screenId} design_system: ${dr.error.message}`);
      } else if (dsAssetBlob) {
        // fall back to the top-level designSystem component blob when per-screen is absent
        dsBlob = dsAssetBlob;
      }

      // eager downloads
      let htmlBlob: BlobRef | null = null;
      if (s.htmlCode?.downloadUrl) {
        const fr = await this.blobs.fetch(s.htmlCode.downloadUrl, s.htmlCode.mimeType ?? 'text/html');
        if (fr.success) htmlBlob = fr.data;
        else warnings.push(`screen ${screenId} html: ${fr.error.code} ${fr.error.message}`);
      }
      let shotBlob: BlobRef | null = null;
      if (s.screenshot?.downloadUrl) {
        const fr = await this.blobs.fetch(s.screenshot.downloadUrl);
        if (fr.success) shotBlob = fr.data;
        else warnings.push(`screen ${screenId} screenshot: ${fr.error.code} ${fr.error.message}`);
      }

      produced.push({
        project_id: (input.args.projectId as string) ?? sc?.projectId ?? '',
        screen_id: screenId,
        name: s.name ?? '',
        parent_screen_id: parent,
        sibling_screen_ids: siblings,
        effective_prompt: s.prompt ?? '',
        html_blob: htmlBlob,
        screenshot_blob: shotBlob,
        theme_blob: themeBlob,
        design_system_blob: dsBlob,
      });
    }

    const completed: Event = {
      id: this.newId(),
      time: input.finished_at,
      trace_id,
      schema_version: 1,
      type: 'call.completed',
      payload: {
        tool: input.tool,
        duration_ms: input.duration_ms,
        kind: 'generative',
        stitch_session_id: typeof sc?.sessionId !== 'undefined' ? String(sc.sessionId) : undefined,
        structured_content_blob: structuredBlob.data,
        produced_screens: produced,
      },
    };
    const cr = await this.append(completed);
    if (!cr.success) return this.fail('CAPTURE_APPEND_FAILED', cr.error.message, true);

    return {
      success: true,
      data: { trace_id, produced_screen_ids: produced.map((p) => p.screen_id), warnings },
    };
  }

  private fail(code: any, message: string, recoverable: boolean): CaptureResult {
    return { success: false, error: { code, message, recoverable } };
  }
}

// --- helpers (extraction over heterogeneous outputComponents) ---------------

function pickScreens(sc: any): ScreenComponent[] {
  const out: ScreenComponent[] = [];
  for (const c of sc?.outputComponents ?? []) {
    if (c?.design?.screens) for (const s of c.design.screens) out.push(s as ScreenComponent);
  }
  return out;
}

function pickDesignSystemComponent(sc: any): Record<string, unknown> | null {
  const c = (sc?.outputComponents ?? []).find((x: any) => x?.designSystem);
  return c?.designSystem ?? null;
}

/**
 * Walk an MCP result and pull out any `name` fields shaped like
 * "projects/<id>" or "screens/<id>". Used to record which entities a
 * read-tool response actually returned so the log is queryable without
 * re-reading the result blob.
 */
function extractReturnedIds(result: unknown): { projects: string[]; screens: string[] } {
  const projects = new Set<string>();
  const screens = new Set<string>();
  const seen = new WeakSet<object>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (seen.has(node as object)) return;
    seen.add(node as object);
    const name = (node as { name?: unknown }).name;
    if (typeof name === 'string') {
      if (name.startsWith('projects/')) projects.add(name.slice('projects/'.length));
      else if (name.startsWith('screens/')) screens.add(name.slice('screens/'.length));
    }
    if (Array.isArray(node)) {
      for (const v of node) visit(v);
    } else {
      for (const v of Object.values(node as Record<string, unknown>)) visit(v);
    }
  };
  visit(result);
  return { projects: Array.from(projects), screens: Array.from(screens) };
}
