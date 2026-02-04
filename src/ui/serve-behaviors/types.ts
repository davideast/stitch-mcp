/**
 * Serve behavior types for the JSON viewer.
 */

export interface ServeContext {
  key: string;
  value: any;
  path: string;
  onProgress?: (message: string) => void;
}

export interface ServeResult {
  success: boolean;
  message: string;
  url?: string;
}

export interface ServeHandler {
  serve(ctx: ServeContext): Promise<ServeResult>;
}

export type PathMatcher = (path: string) => boolean;
