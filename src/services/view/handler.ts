import { type ViewSpec, type ViewInput, type ViewResult } from './spec.js';
import { StitchMCPClient } from '../mcp-client/client.js';

export class ViewHandler implements ViewSpec {
  constructor(private client: StitchMCPClient = new StitchMCPClient()) {}

  async execute(input: ViewInput): Promise<ViewResult> {
    try {
      let data: any;

      if (input.projects) {
        const response = await this.client.listResources();
        data = response;
      } else if (input.name) {
        const response = await this.client.readResource(input.name);
        data = response;
      } else if (input.sourceScreen) {
        const response = await this.client.readResource(input.sourceScreen);
        data = response;
      } else if (input.project && input.screen) {
        const uri = `projects/${input.project}/screens/${input.screen}`;
        const response = await this.client.readResource(uri);
        data = response;
      } else if (input.project) {
        const uri = `projects/${input.project}`;
        const response = await this.client.readResource(uri);
        data = response;
      } else {
        return {
          success: false,
          error: {
            code: 'INVALID_ARGS',
            message: 'No valid view arguments provided. Use --projects, --name, --sourceScreen, or --project.',
            recoverable: false,
          },
        };
      }

      // Pre-process data for better viewing experience
      // If it's an MCP ReadResource result, it has a 'contents' array.
      // We try to parse 'text' fields as JSON.
      if (data && data.contents && Array.isArray(data.contents)) {
          data.contents = data.contents.map((c: any) => {
              if (c.text) {
                  try {
                      // Try to parse the text as JSON
                      const parsed = JSON.parse(c.text);
                      // If successful, replace text with the parsed object for the viewer
                      // or add it as a new field. Replacing makes the tree view immediate.
                      return { ...c, text: undefined, data: parsed };
                  } catch {
                      // Not JSON, keep as is
                      return c;
                  }
              }
              return c;
          });
      }

      return {
        success: true,
        data: data,
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error instanceof Error ? error.message : String(error),
          recoverable: false,
        },
      };
    } finally {
        // Ensure we close the client connection
        try {
            await this.client.close();
        } catch {}
    }
  }
}
