import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ShowSchemaStep } from "../../../../src/commands/tool/steps/ShowSchemaStep.js";
import type { ToolContext } from "../../../../src/commands/tool/context.js";

describe("ShowSchemaStep", () => {
  let step: ShowSchemaStep;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      getCapabilities: mock(),
    };
    step = new ShowSchemaStep();
  });

  function makeContext(overrides: Partial<ToolContext["input"]> = {}): ToolContext {
    return {
      input: { showSchema: false, output: "pretty", ...overrides },
      client: mockClient,
      virtualTools: [],
    };
  }

  describe("shouldRun", () => {
    it("should run when toolName and showSchema are set", async () => {
      expect(await step.shouldRun(makeContext({ toolName: "create_project", showSchema: true }))).toBe(true);
    });

    it("should not run without showSchema", async () => {
      expect(await step.shouldRun(makeContext({ toolName: "create_project" }))).toBe(false);
    });

    it("should not run without toolName", async () => {
      expect(await step.shouldRun(makeContext({ showSchema: true }))).toBe(false);
    });

    it("should not run when toolName is 'list'", async () => {
      expect(await step.shouldRun(makeContext({ toolName: "list", showSchema: true }))).toBe(false);
    });
  });

  describe("run", () => {
    it("should format and return schema", async () => {
      const tool = {
        name: "create_project",
        description: "Creates a project",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Project title" },
          },
          required: ["title"],
        },
      };
      mockClient.getCapabilities.mockResolvedValue({ tools: [tool] });

      const context = makeContext({ toolName: "create_project", showSchema: true });
      await step.run(context);

      expect(context.result!.success).toBe(true);
      expect(context.result!.data).toEqual({
        name: "create_project",
        description: "Creates a project",
        arguments: {
          title: "string (required) - Project title",
        },
        example: `stitch-mcp tool create_project -d '{"title":"<title>"}'`,
      });
    });

    it("should return error if tool not found", async () => {
      mockClient.getCapabilities.mockResolvedValue({ tools: [] });

      const context = makeContext({ toolName: "unknown_tool", showSchema: true });
      await step.run(context);

      expect(context.result!.success).toBe(false);
      expect(context.result!.error).toContain("Tool not found");
    });

    it("should find virtual tools too", async () => {
      const virtualTool = {
        name: "get_screen_code",
        description: "(Virtual) Gets code",
        inputSchema: {
          type: "object",
          properties: { projectId: { type: "string" } },
          required: ["projectId"],
        },
        execute: mock(),
      };
      mockClient.getCapabilities.mockResolvedValue({ tools: [] });

      const context = makeContext({ toolName: "get_screen_code", showSchema: true });
      context.virtualTools = [virtualTool as any];
      await step.run(context);

      expect(context.result!.success).toBe(true);
      expect(context.result!.data.name).toBe("get_screen_code");
    });
  });
});
