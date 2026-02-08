import { describe, it, expect, mock, beforeEach } from "bun:test";
import { ListToolsStep } from "../../../../src/commands/tool/steps/ListToolsStep.js";
import type { ToolContext } from "../../../../src/commands/tool/context.js";

describe("ListToolsStep", () => {
  let step: ListToolsStep;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      getCapabilities: mock(),
    };
    step = new ListToolsStep();
  });

  function makeContext(overrides: Partial<ToolContext["input"]> = {}): ToolContext {
    return {
      input: { showSchema: false, output: "pretty", ...overrides },
      client: mockClient,
      virtualTools: [{ name: "virtual1", execute: mock() }] as any,
    };
  }

  describe("shouldRun", () => {
    it("should run when no toolName is provided", async () => {
      expect(await step.shouldRun(makeContext())).toBe(true);
    });

    it("should run when toolName is 'list'", async () => {
      expect(await step.shouldRun(makeContext({ toolName: "list" }))).toBe(true);
    });

    it("should not run when a specific toolName is given", async () => {
      expect(await step.shouldRun(makeContext({ toolName: "get_screen" }))).toBe(false);
    });
  });

  describe("run", () => {
    it("should combine virtual and server tools", async () => {
      const serverTools = [{ name: "server_tool", description: "desc" }];
      mockClient.getCapabilities.mockResolvedValue({ tools: serverTools });

      const context = makeContext();
      await step.run(context);

      expect(context.result).toBeDefined();
      expect(context.result!.success).toBe(true);
      expect(context.result!.data).toContainEqual(expect.objectContaining({ name: "virtual1" }));
      expect(context.result!.data).toContainEqual(expect.objectContaining({ name: "server_tool" }));
    });

    it("should handle empty server tools", async () => {
      mockClient.getCapabilities.mockResolvedValue({ tools: undefined });

      const context = makeContext();
      await step.run(context);

      expect(context.result!.success).toBe(true);
      expect(context.result!.data).toHaveLength(1); // just the virtual tool
    });
  });
});
