import path from 'node:path';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import * as fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parse } from '@astrojs/compiler';
import { is, serialize } from '@astrojs/compiler/utils';
import type { Stitch } from '@google/stitch-sdk';
import type { GenerateSiteSpec, GenerateSiteInput, GenerateSiteResult, GenerateSiteInputParsed } from './spec.js';
import { GenerateSiteInputSchema } from './spec.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeStagingDir(outputDir: string): string {
  const token = randomBytes(6).toString('hex');
  return path.join(outputDir, `.stitch-staging-${token}`);
}

/**
 * Converts a route path to a filesystem page path.
 * '/'       → 'index.astro'
 * '/about'  → 'about/index.astro'
 */
function routeToPagePath(route: string): string {
  const segments = route.replace(/^\//, '').replace(/\/$/, '');
  return segments ? path.join(segments, 'index.astro') : 'index.astro';
}

/**
 * Applies Astro-specific post-processing to raw HTML:
 * 1. Strips DOCTYPE (Astro adds its own)
 * 2. Prepends `---\n---\n` frontmatter fences
 * 3. Uses the Astro compiler AST to escape `{...}` expressions in text nodes,
 *    leaving <script> and <style> content untouched.
 */
async function rewriteHtmlForAstro(html: string): Promise<string> {
  // Strip DOCTYPE via string replacement (simpler than DOM for this purpose)
  const withoutDoctype = html.replace(/<!DOCTYPE[^>]*>/i, '').trimStart();

  // Add frontmatter fences to make it parseable by the Astro compiler
  const astroContent = `---\n---\n${withoutDoctype}`;

  const parseResult = await parse(astroContent, { position: false });
  const skipElements = new Set(['script', 'style']);

  const escapeExpressions = (node: any, insideSkipElement: boolean): void => {
    const isSkipElement = is.element(node) && skipElements.has(node.name?.toLowerCase());
    const shouldSkip = insideSkipElement || isSkipElement;

    if (is.parent(node) && !shouldSkip) {
      const newChildren: any[] = [];
      for (const child of node.children) {
        if (child.type === 'expression') {
          const exprContent = child.children
            ?.filter((c: any) => is.text(c))
            .map((c: any) => c.value)
            .join('') || '';
          newChildren.push({ type: 'text', value: `{'{'}${exprContent}{'}'}` });
        } else {
          newChildren.push(child);
          escapeExpressions(child, shouldSkip);
        }
      }
      node.children = newChildren;
    } else if (is.parent(node)) {
      for (const child of node.children) {
        escapeExpressions(child, shouldSkip);
      }
    }
  };

  escapeExpressions(parseResult.ast, false);
  return serialize(parseResult.ast);
}

// ── Handler ────────────────────────────────────────────────────────────────────

export class GenerateSiteHandler implements GenerateSiteSpec {
  constructor(private readonly sdk: Stitch) {}

  async execute(rawInput: GenerateSiteInput): Promise<GenerateSiteResult> {
    const parsed = GenerateSiteInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues.map(i => i.message).join('; '),
          recoverable: true,
        },
      };
    }
    return this._generate(parsed.data);
  }

  private async _generate(input: GenerateSiteInputParsed): Promise<GenerateSiteResult> {
    const stagingDir = makeStagingDir(input.outputDir);

    try {
      // ── Phase 1: SDK downloads HTML + assets to staging dir ──────────────────
      try {
        const project = this.sdk.project(input.projectId);
        await project.downloadAssets(stagingDir, {
          fileMode: input.fileMode,
          tempDir: input.tempDir,
          assetsSubdir: input.assetsSubdir,
        });
      } catch (e: any) {
        const isStitchError = e && typeof e === 'object' && 'code' in e && 'recoverable' in e;
        let code: GenerateSiteErrorCode = 'DOWNLOAD_FAILED';
        if (isStitchError) {
          if (e.code === 'NOT_FOUND') code = 'NOT_FOUND';
          if (e.code === 'NETWORK_ERROR') code = 'NETWORK_ERROR';
          if (e.code === 'RATE_LIMITED') code = 'RATE_LIMITED';
          if (e.code === 'VALIDATION_ERROR') code = 'VALIDATION_ERROR';
        }

        return {
          success: false,
          error: {
            code,
            message: e instanceof Error ? e.message : String(e),
            recoverable: isStitchError ? e.recoverable : false,
          },
        };
      }

      // ── Phase 2: Astro post-processing ───────────────────────────────────────
      const project = this.sdk.project(input.projectId);
      const sdkScreens = await project.screens();
      const screenMap = new Map(sdkScreens.map((s: any) => [s.screenId, s]));

      const pagesDir = path.join(input.outputDir, 'src', 'pages');
      await mkdir(pagesDir, { recursive: true });

      for (const { screenId, route } of input.routes) {
        const screen = screenMap.get(screenId);
        const screenSlug = screen?.title 
          ? screen.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
          : screenId;

        const stagedHtmlPath = path.join(stagingDir, screenSlug, 'code.html');
        let html: string;
        try {
          html = await readFile(stagedHtmlPath, 'utf-8');
        } catch (e: any) {
          return {
            success: false,
            error: {
              code: 'DOWNLOAD_FAILED',
              message: `Failed to read staged HTML for ${screenId}: ${e.message}`,
              recoverable: false,
            },
          };
        }

        let astroContent: string;
        try {
          astroContent = await rewriteHtmlForAstro(html);
        } catch (e: any) {
          return {
            success: false,
            error: {
              code: 'ASTRO_REWRITE_FAILED',
              message: `Failed to compile Astro HTML for ${screenId}: ${e.message}`,
              recoverable: false,
            },
          };
        }

        const relPagePath = routeToPagePath(route);
        const absPagePath = path.join(pagesDir, relPagePath);
 
        try {
          await mkdir(path.dirname(absPagePath), { recursive: true });
          await writeFile(absPagePath, astroContent, 'utf-8');
        } catch (e: any) {
          return {
            success: false,
            error: {
              code: 'WRITE_FAILED',
              message: `Failed to write Astro page to disk for ${screenId}: ${e.message}`,
              recoverable: false,
            },
          };
        }
      }

      // Clean up staging dir
      await rm(stagingDir, { recursive: true, force: true });

      return {
        success: true,
        outputDir: input.outputDir,
        pages: input.routes.map(r => ({ screenId: r.screenId, route: r.route })),
      };
    } catch (e: any) {
      // Best-effort cleanup
      await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: e instanceof Error ? e.message : String(e),
          recoverable: false,
        },
      };
    }
  }
}
