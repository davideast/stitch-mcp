import { type ViewSpec, type ViewInput, type ViewResult } from './spec.js';
import { StitchMCPClient } from '../mcp-client/client.js';

export class ViewHandler implements ViewSpec {
  constructor(private client: StitchMCPClient = new StitchMCPClient()) {}

  async execute(input: ViewInput): Promise<ViewResult> {
    try {
      let data: any;

      if (input.projects) {
        data = await this.client.callTool('list_projects', {});
      } else if (input.name) {
        // Parse the resource name to determine the correct tool call
        // Format: "projects/{id}" or "projects/{id}/screens/{screenId}"
        const projectMatch = input.name.match(/^projects\/([^/]+)$/);
        const screenMatch = input.name.match(/^projects\/([^/]+)\/screens\/([^/]+)$/);

        if (screenMatch) {
          data = await this.client.callTool('get_screen', {
            projectId: screenMatch[1],
            screenId: screenMatch[2]
          });
        } else if (projectMatch) {
          data = await this.client.callTool('get_project', {
            name: `projects/${projectMatch[1]}`
          });
        } else {
          throw new Error(`Invalid resource name format: ${input.name}`);
        }
      } else if (input.sourceScreen) {
        const screenMatch = input.sourceScreen.match(/^projects\/([^/]+)\/screens\/([^/]+)$/);
        if (screenMatch) {
            data = await this.client.callTool('get_screen', {
                projectId: screenMatch[1],
                screenId: screenMatch[2]
            });
        } else {
            throw new Error(`Invalid sourceScreen format: ${input.sourceScreen}`);
        }
      } else if (input.project && input.screen) {
        data = await this.client.callTool('get_screen', {
          projectId: input.project,
          screenId: input.screen
        });
      } else if (input.project) {
        data = await this.client.callTool('get_project', {
          name: `projects/${input.project}`
        });
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
