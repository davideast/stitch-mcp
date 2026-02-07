import fs from 'fs-extra';
import { type SnapshotCommand, type SnapshotInput, type SnapshotResult } from './spec.js';
import { MockUI } from '../../framework/MockUI.js';
import { theme } from '../../ui/theme.js';
import { type GcloudService } from '../../services/gcloud/spec.js';
import { type StitchService } from '../../services/stitch/spec.js';
import { type McpConfigService } from '../../services/mcp-config/spec.js';
import { type ProjectService } from '../../services/project/spec.js';

interface SnapshotServices {
  gcloud?: GcloudService;
  stitch?: StitchService;
  mcpConfig?: McpConfigService;
  project?: ProjectService;
}

// Schemas for the commands to be printed with -s
const SCHEMAS: Record<string, any> = {
  init: {
    description: "Data schema for 'init' command",
    type: "object",
    properties: {
      mcpClient: { type: "string", enum: ["vscode", "cursor", "claude-code", "gemini-cli", "codex", "opencode"] },
      authMode: { type: "string", enum: ["apiKey", "oauth"] },
      transportType: { type: "string", enum: ["http", "stdio"] },
      apiKeyStorage: { type: "string", enum: ["config", "skip", ".env"] },
      apiKey: { type: "string" },
      confirm: { type: "boolean" },
      inputArgs: {
        type: "object",
        description: "Arguments to pass to the command execution",
        properties: {
          local: { type: "boolean" },
          defaults: { type: "boolean" },
          autoVerify: { type: "boolean" },
          client: { type: "string" },
          transport: { type: "string" }
        }
      }
    },
    required: ["mcpClient", "authMode"]
  },
  doctor: {
    description: "Data schema for 'doctor' command",
    type: "object",
    properties: {
      confirm: { type: "boolean" },
      inputArgs: {
        type: "object",
        description: "Arguments to pass to the command execution",
        properties: {
          verbose: { type: "boolean" }
        }
      }
    }
  },
  site: {
    description: "Data schema for 'site' command",
    type: "object",
    properties: {
      screens: {
        type: "array",
        items: {
          type: "object",
          properties: {
             id: { type: "string" },
             title: { type: "string" },
             description: { type: "string" },
             type: { type: "string" },
             content: { type: "string" }
          }
        }
      },
      inputArgs: {
         type: "object",
         properties: {
             projectId: { type: "string" },
             outputDir: { type: "string" }
         }
      }
    }
  }
};

export class SnapshotHandler implements SnapshotCommand {
  constructor(private readonly services?: SnapshotServices) {}

  async execute(input: SnapshotInput): Promise<SnapshotResult> {
    if (input.schema) {
      if (input.command) {
        const schema = SCHEMAS[input.command];
        if (!schema) {
          return {
             success: false,
             error: { message: `No schema found for command '${input.command}'` }
          };
        }
        console.log(JSON.stringify(schema, null, 2));
      } else {
        console.log(JSON.stringify(Object.keys(SCHEMAS), null, 2));
      }
      return { success: true };
    }

    if (!input.command) {
      return { success: false, error: { message: "Command (-c) is required unless using -s" } };
    }
    if (!input.data) {
      return { success: false, error: { message: "Data file (-d) is required unless using -s" } };
    }

    // Load data
    let data: any;
    try {
      if (await fs.pathExists(input.data)) {
        data = await fs.readJson(input.data);
      } else {
        // Try parsing as JSON string
        try {
          data = JSON.parse(input.data);
        } catch {
           return { success: false, error: { message: `Data file not found at '${input.data}' and content is not valid JSON` } };
        }
      }
    } catch (e) {
       return { success: false, error: { message: `Failed to read data: ${e instanceof Error ? e.message : String(e)}` } };
    }

    const mockUI = new MockUI(data);

    try {
      switch (input.command) {
        case 'init': {
          const { InitHandler } = await import('../init/handler.js');
          const handler = new InitHandler(
            this.services?.gcloud,
            this.services?.mcpConfig,
            this.services?.project,
            this.services?.stitch,
            mockUI
          );
          const initInput = {
             local: false,
             defaults: false,
             autoVerify: true,
             ...data.inputArgs
          };
          await handler.execute(initInput);
          break;
        }
        case 'doctor': {
          const { DoctorHandler } = await import('../doctor/handler.js');
          const handler = new DoctorHandler(
            this.services?.gcloud,
            this.services?.stitch,
            mockUI
          );
          const doctorInput = {
             verbose: false,
             ...data.inputArgs
          };
          await handler.execute(doctorInput);
          break;
        }
        case 'site': {
          const { SiteBuilder } = await import('../site/ui/SiteBuilder.js');
          const { MockStitchMCPClient } = await import('../../services/mcp-client/MockStitchMCPClient.js');

          const mockScreens = data.screens || [];
          const mockClient = new MockStitchMCPClient(mockScreens);

          // Use ink-testing-library to render and snapshot the UI
          try {
             // We use require to avoid type checking issues if it's not installed in prod build env,
             // although this command is a dev tool.
             const { render } = await import('ink-testing-library');
             const React = await import('react');

             const projectId = data.inputArgs?.projectId || 'mock-project';

             const { lastFrame, unmount } = render(
                React.createElement(SiteBuilder, {
                    projectId,
                    client: mockClient,
                    onExit: () => {}
                })
             );

             // Wait for async operations (loading screens)
             // Simple delay for now, or check frame content until "Loading" is gone
             // Since we can't easily wait for a specific state without more complex logic,
             // let's try a short delay to allow useEffect to run.
             await new Promise(resolve => setTimeout(resolve, 1000));

             console.log(lastFrame());
             unmount();
          } catch (e) {
             if ((e as any).code === 'ERR_MODULE_NOT_FOUND') {
                 console.warn(theme.yellow('ink-testing-library not found. Install dev dependencies to snapshot site command.'));
             } else {
                 throw e;
             }
          }
          break;
        }
        default:
          return { success: false, error: { message: `Unsupported command '${input.command}'` } };
      }
    } catch (error) {
       console.error(theme.red('Command execution failed:'), error);
       // Return success: true because the snapshotting process ran, even if the command failed.
       // The error is part of the snapshot.
       return { success: true };
    }

    return { success: true };
  }
}
