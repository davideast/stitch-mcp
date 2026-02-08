import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ExecuteToolStep } from "../../../../src/commands/tool/steps/ExecuteToolStep.js";
import type { ToolContext } from "../../../../src/commands/tool/context.js";

describe("ExecuteToolStep", () => {
  let step: ExecuteToolStep;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      callTool: mock(),
    };
    step = new ExecuteToolStep();
  });

  function makeContext(overrides: Partial<ToolContext> = {}): ToolContext {
    return {
      input: { toolName: "some_tool", showSchema: false, output: "pretty" },
      client: mockClient,
      virtualTools: [],
      ...overrides,
    };
  }

  describe("shouldRun", () => {
    it("should run when parsedArgs is set", async () => {
      expect(await step.shouldRun(makeContext({ parsedArgs: {} }))).toBe(true);
    });

    it("should not run when parsedArgs is undefined", async () => {
      expect(await step.shouldRun(makeContext())).toBe(false);
    });
  });

  describe("run", () => {
    it("should call server tool via client", async () => {
      const mockResult = { id: "123" };
      mockClient.callTool.mockResolvedValue(mockResult);

      const context = makeContext({ parsedArgs: { title: "Test" } });
      await step.run(context);

      expect(context.result).toEqual({ success: true, data: mockResult });
      expect(mockClient.callTool).toHaveBeenCalledWith("some_tool", { title: "Test" });
    });

    it("should execute virtual tool when name matches", async () => {
      const mockExecute = mock(() => Promise.resolve({ virtual: true }));
      const virtualTool = { name: "some_tool", execute: mockExecute } as any;

      const context = makeContext({ parsedArgs: { key: "val" }, virtualTools: [virtualTool] });
      await step.run(context);

      expect(context.result).toEqual({ success: true, data: { virtual: true } });
      expect(mockExecute).toHaveBeenCalledWith(mockClient, { key: "val" });
      expect(mockClient.callTool).not.toHaveBeenCalled();
    });

    it("should handle virtual tool execution failure", async () => {
      const mockExecute = mock(() => Promise.reject(new Error("boom")));
      const virtualTool = { name: "some_tool", execute: mockExecute } as any;

      const context = makeContext({ parsedArgs: {}, virtualTools: [virtualTool] });
      await step.run(context);

      expect(context.result!.success).toBe(false);
      expect(context.result!.error).toContain("Virtual tool execution failed");
      expect(context.result!.error).toContain("boom");
    });
  });
});
