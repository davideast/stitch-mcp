import fs from 'fs-extra';
import { type SnapshotCommand, type SnapshotInput, type SnapshotResult } from './spec.js';
import { MockUI } from '../../framework/MockUI.js';
import { theme } from '../../ui/theme.js';

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
  }
};

export class SnapshotHandler implements SnapshotCommand {
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
          const handler = new InitHandler(undefined, undefined, undefined, undefined, mockUI);
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
          const handler = new DoctorHandler(undefined, undefined, mockUI);
          const doctorInput = {
             verbose: false,
             ...data.inputArgs
          };
          await handler.execute(doctorInput);
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
