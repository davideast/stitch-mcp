import type {
  UploadInput,
  UploadResult,
  UploadSpec,
  UploadedScreen,
} from './spec.js';

// ── Dependency injection port ──────────────────────────────────────────────────

/**
 * The upload function injected into the handler.
 * In production this calls project.upload() via the SDK.
 * In tests this is a mock.
 */
export type UploadFn = (
  projectId: string,
  filePath: string,
  title: string | undefined,
) => Promise<UploadedScreen[]>;

export interface UploadHandlerDeps {
  upload: UploadFn;
}

// ── Error classification ───────────────────────────────────────────────────────

function classifyError(err: unknown): UploadResult {
  if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'ENOENT') {
    return {
      success: false,
      error: { code: 'FILE_NOT_FOUND', message: (err as any).message || 'File not found', recoverable: false },
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes('unsupported file extension') || lower.includes('unsupported format')) {
    return {
      success: false,
      error: { code: 'UNSUPPORTED_FORMAT', message, recoverable: false },
    };
  }

  if (lower.includes('401') || lower.includes('403') || lower.includes('auth')) {
    return {
      success: false,
      error: { code: 'AUTH_FAILED', message, recoverable: false },
    };
  }

  if (lower.includes('network') || lower.includes('timeout') || lower.includes('fetch')) {
    return {
      success: false,
      error: { code: 'UPLOAD_FAILED', message, recoverable: true },
    };
  }

  const isUploadError = lower.includes('upload') || lower.includes('request failed');
  if (isUploadError) {
    return {
      success: false,
      error: { code: 'UPLOAD_FAILED', message, recoverable: true },
    };
  }

  return {
    success: false,
    error: { code: 'UNKNOWN_ERROR', message: message || 'An unknown error occurred', recoverable: false },
  };
}

// ── Handler ────────────────────────────────────────────────────────────────────

/**
 * Implements UploadSpec.
 * Never throws — all failures are returned as typed Result values.
 * Receives the upload function as a dependency so it can be tested in isolation.
 */
export class UploadHandler implements UploadSpec {
  private readonly upload: UploadFn;

  constructor(deps: UploadHandlerDeps) {
    this.upload = deps.upload;
  }

  async execute(input: UploadInput): Promise<UploadResult> {
    try {
      const screens = await this.upload(input.projectId, input.filePath, input.title);
      return { success: true, screens };
    } catch (err) {
      return classifyError(err);
    }
  }
}

