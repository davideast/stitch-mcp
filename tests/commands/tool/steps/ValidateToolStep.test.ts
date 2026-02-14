import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ValidateToolStep } from "../../../../src/commands/tool/steps/ValidateToolStep.js";
import type { ToolContext } from "../../../../src/commands/tool/context.js";

describe("ValidateToolStep", () => {
  let step: ValidateToolStep;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      getCapabilities: mock(),
    };
    step = new ValidateToolStep();
  });

  function makeContext(overrides: Partial<ToolContext> & { inputOverrides?: Partial<ToolContext["input"]> } = {}): ToolContext {
    const { inputOverrides, ...rest } = overrides;
    return {
      input: { toolName: "some_tool", showSchema: false, output: "pretty", ...inputOverrides },
      client: mockClient,
      virtualTools: [],
      ...rest,
    };
  }

  describe("shouldRun", () => {
    it("should not run when no parsedArgs (no tool to validate)", async () => {
      expect(await step.shouldRun(makeContext())).toBe(false);
    });

    it("should not run when showSchema is true", async () => {
      expect(await step.shouldRun(makeContext({ parsedArgs: {}, inputOverrides: { showSchema: true } }))).toBe(false);
    });

    it("should not run when toolName is 'list'", async () => {
      expect(await step.shouldRun(makeContext({ parsedArgs: {}, inputOverrides: { toolName: "list" } }))).toBe(false);
    });

    it("should run when parsedArgs is set and toolName is specified", async () => {
      expect(await step.shouldRun(makeContext({ parsedArgs: {} }))).toBe(true);
    });
  });

  describe("run", () => {
    it("should pass when tool name matches a server tool", async () => {
      const serverTools = [{ name: "some_tool", description: "desc" }];
      mockClient.getCapabilities.mockResolvedValue({ tools: serverTools });

      const context = makeContext({ parsedArgs: {} });
      const result = await step.run(context);

      expect(result.success).toBe(true);
      expect(context.result).toBeUndefined();
    });

    it("should pass when tool name matches a virtual tool", async () => {
      mockClient.getCapabilities.mockResolvedValue({ tools: [] });
      const virtualTool = { name: "some_tool", execute: mock() } as any;

      const context = makeContext({ parsedArgs: {}, virtualTools: [virtualTool] });
      const result = await step.run(context);

      expect(result.success).toBe(true);
      expect(context.result).toBeUndefined();
    });

    it("should fail with helpful error when tool name is not found", async () => {
      const serverTools = [{ name: "get_screens", description: "Gets screens" }];
      mockClient.getCapabilities.mockResolvedValue({ tools: serverTools });
      const virtualTool = { name: "build_site", execute: mock() } as any;

      const context = makeContext({
        parsedArgs: {},
        virtualTools: [virtualTool],
        inputOverrides: { toolName: "nonexistent" },
      });
      const result = await step.run(context);

      expect(result.success).toBe(false);
      expect(context.result!.success).toBe(false);
      expect(context.result!.error).toContain('Tool not found: "nonexistent"');
      expect(context.result!.error).toContain("list_tools");
      expect(context.result!.data.requestedTool).toBe("nonexistent");
      expect(context.result!.data.availableTools).toContain("build_site");
      expect(context.result!.data.availableTools).toContain("get_screens");
      expect(context.result!.data.hint).toContain("list_tools");
    });

    it("should handle empty tools list", async () => {
      mockClient.getCapabilities.mockResolvedValue({ tools: undefined });

      const context = makeContext({ parsedArgs: {}, inputOverrides: { toolName: "anything" } });
      const result = await step.run(context);

      expect(result.success).toBe(false);
      expect(context.result!.error).toContain('Tool not found: "anything"');
    });
  });
});
